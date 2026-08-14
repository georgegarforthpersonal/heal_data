/**
 * Group detail: the single-screen overview for one survey type. Neutral hero
 * plus two balanced columns — Surveys + Species count (left); Files, Routes
 * (right). Data joins whichever column is shorter: the left one when the
 * Seasonal counts chart occupies the right, the right one otherwise.
 * The Surveys panel is the slot-driven worklist for scheduled
 * ('worklist') groups, or a record-CTA + recent-history panel for unscheduled
 * ('record') ones; media groups additionally get a recent photos/clips panel.
 *
 * The page paints progressively: chrome (breadcrumb + hero skeleton)
 * renders immediately, the hero hydrates when the type details arrive, and
 * each panel hydrates from its own fetch behind a skeleton — nothing hides
 * the whole page behind one spinner. Location geometry comes from the
 * type-scoped endpoint, not the whole organisation's.
 *
 * On mobile the panels stack Surveys-first (the worklist is why the page is
 * opened); Files sits below the working panels.
 */
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Alert, Box, Button, Skeleton, Typography } from '@mui/material';
import {
  ApiError,
  surveyTypesAPI,
  surveysAPI,
  scheduledSurveysAPI,
  surveyorsAPI,
  locationsAPI,
  type SurveyTypeWithDetails,
  type ScheduledSurvey,
  type Survey,
  type Surveyor,
  type LocationWithBoundary,
  type SurveyTypeFile,
} from '../../services/api';
import { groupColors, GROUP_MAX_WIDTH } from './groupsTokens';
import { groupActivity, primarySpeciesType, recordSurveyPath, resolveGroupTypeId } from './groupMeta';
import { useDocumentTitle, useSignupSaved, useSurveyorLookup } from '../../hooks';
import GroupBreadcrumb from '../../components/groups/GroupBreadcrumb';
import GroupHero from '../../components/groups/GroupHero';
import PanelSkeleton from '../../components/groups/PanelSkeleton';
import SurveysPanel from '../../components/groups/SurveysPanel';
import RecordPanel from '../../components/groups/RecordPanel';
import RecentMediaPanel from '../../components/groups/RecentMediaPanel';
import FilesPanel from '../../components/groups/FilesPanel';
import LocationsPanel from '../../components/groups/LocationsPanel';
import SpeciesCountPanel from '../../components/groups/SpeciesCountPanel';
import SingleSpeciesCountPanel from '../../components/groups/SingleSpeciesCountPanel';
import SeasonalCountPanel from '../../components/groups/SeasonalCountPanel';
import DataPanel from '../../components/groups/DataPanel';

export default function GroupDetailPage() {
  const { typeId } = useParams<{ typeId: string }>();
  const navigate = useNavigate();

  const [surveyType, setSurveyType] = useState<SurveyTypeWithDetails | null>(null);
  const [slots, setSlots] = useState<ScheduledSurvey[]>([]);
  const [recentSurveys, setRecentSurveys] = useState<Survey[]>([]);
  const [recordedCount, setRecordedCount] = useState<number | null>(null);
  const [surveyors, setSurveyors] = useState<Surveyor[]>([]);
  // null = still loading (locations panel shows a skeleton).
  const [locations, setLocations] = useState<LocationWithBoundary[] | null>(null);
  const [activityLoading, setActivityLoading] = useState(true);
  const [files, setFiles] = useState<SurveyTypeFile[]>([]);
  const [filesLoading, setFilesLoading] = useState(true);
  const [filesError, setFilesError] = useState(false);
  const [filesAttempt, setFilesAttempt] = useState(0);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [resolvedId, setResolvedId] = useState<number | null>(null);

  const [greenIds, setGreenIds] = useState<Set<number>>(new Set());

  useDocumentTitle(surveyType?.name);

  useEffect(() => {
    if (!typeId) {
      setNotFound(true);
      return;
    }
    let active = true;
    setError(false);
    setNotFound(false);

    (async () => {
      try {
        // The route param is a name slug (or a legacy numeric id) — resolve
        // it to the survey type id (cached across navigations) first.
        const surveyTypeId = await resolveGroupTypeId(typeId);
        if (!active) return;
        if (surveyTypeId == null) {
          setNotFound(true);
          setFilesLoading(false);
          return;
        }
        setResolvedId(surveyTypeId);

        // Location geometry is scoped to this survey type (sector colours
        // resolve to their parent route server-side). If the geometry call
        // fails the page degrades to the geometry-free list from the type
        // details rather than blocking or lying (the failure changes
        // nothing the fallback below hasn't already covered).
        locationsAPI
          .getBySurveyTypeWithGeometry(surveyTypeId)
          .then((locs) => active && setLocations(locs.map((l) => ({ ...l, boundary_geometry: l.boundary_geometry ?? null }))))
          .catch(() => {});

        const details = await surveyTypesAPI.getById(surveyTypeId);
        if (!active) return;
        setSurveyType(details);
        // Geometry fallback: the details' location list (no geometry) keeps
        // the panel truthful if the scoped geometry call failed or is slow.
        setLocations((prev) =>
          prev ?? details.locations.map((loc) => ({
            id: loc.id,
            name: loc.name,
            parent_name: loc.parent_name ?? null,
            ordinal: loc.ordinal ?? null,
            location_type: loc.location_type,
            color: loc.color ?? null,
            geometry: null,
            boundary_geometry: null,
            sectors: null,
          })),
        );

        // The worklist is built from the group's slots (linked recorded
        // surveys come embedded, so fulfilment derives from the same list);
        // every variant's Recent section shows the most recent surveys from
        // the same paged call that gives it its recorded total (the list is
        // date-descending, so page 1 IS the recent list).
        const scheduled = groupActivity(details.name) === 'worklist';
        setActivityLoading(true);
        const [slotList, surveysPage, surveyorList] = await Promise.all([
          scheduled
            ? scheduledSurveysAPI.getAll({ survey_type_id: surveyTypeId })
            : Promise.resolve([]),
          surveysAPI.getAll({ survey_type_id: surveyTypeId, page: 1, limit: 3 }),
          surveyorsAPI.getAll(),
        ]);
        if (!active) return;

        setSlots(slotList);
        setRecentSurveys(surveysPage.data);
        setRecordedCount(surveysPage.total);
        setSurveyors(surveyorList);
        setActivityLoading(false);
      } catch (err) {
        // Only a 404 means the group doesn't exist; anything else is a fault.
        if (active) {
          if (err instanceof ApiError && err.status === 404) setNotFound(true);
          else setError(true);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [typeId, attempt]);

  // Files load (and retry) independently so a slow/failed files call doesn't
  // block the page — but a failure renders as a failure, not "No files yet".
  useEffect(() => {
    if (resolvedId == null) return;
    let active = true;
    setFilesLoading(true);
    setFilesError(false);
    surveyTypesAPI
      .getFiles(resolvedId)
      .then((f) => active && setFiles(f))
      .catch(() => active && setFilesError(true))
      .finally(() => active && setFilesLoading(false));
    return () => {
      active = false;
    };
  }, [resolvedId, filesAttempt]);

  const resolveSurveyors = useSurveyorLookup(surveyors);
  const handleSignupSaved = useSignupSaved(slots, setSlots, setGreenIds, surveyors, setSurveyors);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  if (error) {
    return (
      <Box sx={{ maxWidth: GROUP_MAX_WIDTH, mx: 'auto', px: { xs: 2, sm: 4 }, py: 4 }}>
        <GroupBreadcrumb crumbs={[{ label: 'Surveys', to: '/groups' }, { label: 'Error' }]} />
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={retry} sx={{ fontWeight: 700 }}>
              Retry
            </Button>
          }
        >
          Couldn’t load this page.
        </Alert>
      </Box>
    );
  }

  if (notFound) {
    return (
      <Box sx={{ maxWidth: GROUP_MAX_WIDTH, mx: 'auto', px: { xs: 2, sm: 4 }, py: 4 }}>
        <GroupBreadcrumb crumbs={[{ label: 'Surveys', to: '/groups' }, { label: 'Not found' }]} />
        <Typography sx={{ color: groupColors.textSecondary, mb: 2 }}>
          This page doesn’t exist — the survey group may have been renamed or removed.
        </Typography>
        <Button
          variant="outlined"
          onClick={() => navigate('/groups')}
          sx={{ textTransform: 'none', color: groupColors.brandDark, borderColor: groupColors.brand, fontWeight: 600 }}
        >
          Browse all surveys
        </Button>
      </Box>
    );
  }

  const loadingDetails = surveyType === null;
  const speciesType = surveyType ? primarySpeciesType(surveyType) : 'butterfly';
  // A survey type narrowed to exactly one species (e.g. Marsh Fritillary)
  // gets the per-survey seasonal count panel instead of the diversity chart.
  const singleSpecies = surveyType && surveyType.species.length === 1 ? surveyType.species[0] : null;
  const activity = surveyType ? groupActivity(surveyType.name) : 'worklist';
  // Seasonal counts need repeat visits through a season to compare, so they
  // belong to the scheduled groups: Bird, Butterfly, Dragonfly today.
  // Single-species scheduled groups already get the same chart from
  // SingleSpeciesCountPanel, without a picker.
  const hasSeasonal = activity === 'worklist' && !singleSpecies;
  const returnTo = surveyType
    ? { returnTo: { pathname: `/groups/${typeId}`, label: surveyType.name } }
    : undefined;
  // Unscheduled groups record without a slot: media types jump straight to
  // their wizard, plain types to the standard form with the type preselected.
  const recordNew = () => surveyType && navigate(recordSurveyPath(surveyType), { state: returnTo });
  // Slot-aware recording: the form gets the week's window, so the date lands
  // inside the week being fulfilled and the banner can say which week.
  const recordForSlot = (slot: ScheduledSurvey) =>
    surveyType &&
    navigate(
      `${recordSurveyPath(surveyType)}&window_start=${slot.window_start}&window_end=${slot.window_end}`,
      { state: returnTo },
    );
  const openSurvey = (survey: Survey) => navigate(`/surveys/${survey.id}`, { state: returnTo });

  const dataPanel = surveyType && (
    <Box sx={{ order: 7, minWidth: 0 }}>
      <DataPanel
        surveyTypeId={surveyType.id}
        surveyTypeName={surveyType.name}
        recordedCount={recordedCount ?? undefined}
      />
    </Box>
  );

  return (
    <Box sx={{ bgcolor: groupColors.page, minHeight: '100%', px: { xs: 2, sm: 4 }, py: { xs: 2, sm: 3 } }}>
      <Box sx={{ maxWidth: GROUP_MAX_WIDTH, mx: 'auto' }}>
        <GroupBreadcrumb
          crumbs={[{ label: 'Surveys', to: '/groups' }, { label: surveyType?.name ?? '…' }]}
        />

        {loadingDetails ? (
          <Skeleton variant="rounded" height={116} sx={{ borderRadius: '12px' }} />
        ) : (
          <GroupHero surveyType={surveyType} />
        )}

        {/* On xs the column wrappers become display: contents so the panels
            stack as direct flex items in their `order` — Surveys first, the
            working panels next, Files below them; the md column grouping is
            unaffected (orders preserve in-column order). */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            alignItems: { xs: 'stretch', md: 'flex-start' },
            gap: 2.25,
            mt: 2.25,
          }}
        >
          {/* Left column */}
          <Box sx={{ display: { xs: 'contents', md: 'flex' }, flexDirection: 'column', gap: 2.25, flex: 1, minWidth: 0 }}>
            <Box sx={{ order: 1, minWidth: 0 }}>
              {loadingDetails || (activityLoading && recentSurveys.length === 0 && slots.length === 0) ? (
                <PanelSkeleton titleWidth={72} rows={4} />
              ) : activity === 'record' ? (
                <RecordPanel
                  surveys={recentSurveys}
                  recordedCount={recordedCount ?? 0}
                  resolveSurveyors={resolveSurveyors}
                  speciesType={speciesType}
                  recordLabel={
                    surveyType!.allow_image_upload || surveyType!.allow_audio_upload
                      ? 'Record survey'
                      : 'Log a sighting'
                  }
                  onRecord={recordNew}
                  onOpenSurvey={openSurvey}
                  onViewAll={() => navigate(`/groups/${typeId}/all`)}
                />
              ) : (
                <SurveysPanel
                  slots={slots}
                  resolveSurveyors={resolveSurveyors}
                  recordedCount={recordedCount ?? 0}
                  recentSurveys={recentSurveys}
                  speciesType={speciesType}
                  greenIds={greenIds}
                  onSignupSaved={handleSignupSaved}
                  onOpenRecorded={openSurvey}
                  onViewAll={() => navigate(`/groups/${typeId}/all`)}
                  onRecordNew={recordNew}
                  onRecordSlot={recordForSlot}
                />
              )}
            </Box>
            <Box sx={{ order: 3, minWidth: 0 }}>
              {loadingDetails ? (
                <PanelSkeleton titleWidth={120} blockHeight={240} />
              ) : singleSpecies ? (
                <SingleSpeciesCountPanel surveyTypeId={surveyType!.id} species={singleSpecies} />
              ) : (
                <SpeciesCountPanel speciesTypes={surveyType!.species_types.map((st) => st.name)} surveyTypeId={surveyType!.id} />
              )}
            </Box>
            {surveyType && (surveyType.allow_image_upload || surveyType.allow_audio_upload) && (
              <Box sx={{ order: 5, minWidth: 0 }}>
                <RecentMediaPanel
                  kind={surveyType.allow_image_upload ? 'photos' : 'clips'}
                  surveyTypeId={surveyType.id}
                  onViewAll={() => navigate(`/groups/${typeId}/media`)}
                />
              </Box>
            )}
            {/* The seasonal chart makes the right column the tall one, so Data
                balances into the left column; on xs its order still stacks it
                last either way. */}
            {hasSeasonal && dataPanel}
          </Box>

          {/* Right column */}
          <Box sx={{ display: { xs: 'contents', md: 'flex' }, flexDirection: 'column', gap: 2.25, flex: 1, minWidth: 0 }}>
            {/* Files never own the first phone screenful — the worklist and
                maps are why the page is opened. Desktop keeps Files on top of
                its column, where the two-column layout has room. */}
            <Box sx={{ order: { xs: 4, md: 1 }, minWidth: 0 }}>
              <FilesPanel
                surveyTypeId={resolvedId ?? 0}
                files={files}
                loading={filesLoading || resolvedId == null}
                error={filesError}
                onRetry={() => setFilesAttempt((n) => n + 1)}
              />
            </Box>
            <Box sx={{ order: 2, minWidth: 0 }}>
              {locations === null ? (
                <PanelSkeleton titleWidth={90} blockHeight={360} />
              ) : (
                <LocationsPanel locations={locations} devices={surveyType?.devices ?? []} />
              )}
            </Box>
            {hasSeasonal && surveyType && (
              <Box sx={{ order: 6, minWidth: 0 }}>
                <SeasonalCountPanel
                  surveyTypeId={surveyType.id}
                  speciesTypes={surveyType.species_types.map((st) => st.name)}
                />
              </Box>
            )}
            {!hasSeasonal && dataPanel}
          </Box>
        </Box>
      </Box>

    </Box>
  );
}
