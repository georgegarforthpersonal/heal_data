import { Box, Typography, Paper, ButtonBase, Autocomplete, TextField } from '@mui/material';
import { useState, useEffect } from 'react';
import dayjs from 'dayjs';
import { dashboardAPI, locationsAPI, getOrgSlug } from '../services/api';
import type { SpeciesWithCount, SpeciesSightingLocation, LocationWithBoundary } from '../services/api';
import SightingsMap from '../components/dashboard/SightingsMap';
import CumulativeSpeciesChart from '../components/dashboard/CumulativeSpeciesChart';
import SpeciesOccurrenceChart from '../components/dashboard/SpeciesOccurrenceChart';
import SpeciesGroupIcon from '../components/dashboard/SpeciesGroupIcon';
import { speciesTypes, getSpeciesDisplayName } from '../config';
import { notionColors, brandColors } from '../theme';
import { SPACING } from '../config/responsive';
import { PageTitle } from '../components/layout/PageTitle';

/** Headline figures for the selected species group, all derived from the
 * ranked species list the page already fetches. */
function groupStats(speciesList: SpeciesWithCount[]) {
  const year = String(new Date().getFullYear());
  const individuals = speciesList.reduce((sum, s) => sum + s.total_count, 0);
  const newThisYear = speciesList.filter((s) => s.first_observed?.startsWith(year)).length;
  const latest = speciesList.reduce<SpeciesWithCount | null>(
    (best, s) =>
      s.first_observed && (!best?.first_observed || s.first_observed > best.first_observed) ? s : best,
    null,
  );
  return { species: speciesList.length, individuals, newThisYear, latest };
}

/**
 * One figure in the stats band. Labels are sentence case and WRAP — uppercase
 * no-wrap labels truncated on phones ("NEW SPECIES THIS ..."). `hero` marks
 * the single lead figure of the view.
 */
function Stat({ label, value, sub, hero = false }: { label: string; value: string; sub?: string; hero?: boolean }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography
        sx={{
          fontSize: hero ? 40 : 24,
          fontWeight: 600,
          lineHeight: 1.1,
          letterSpacing: hero ? -0.5 : 0,
          overflowWrap: 'anywhere',
        }}
      >
        {value}
      </Typography>
      {sub && (
        <Typography sx={{ fontSize: 12.5, color: 'text.secondary', mt: 0.25 }}>{sub}</Typography>
      )}
      <Typography sx={{ fontSize: 12.5, color: 'text.secondary', mt: 0.5 }}>{label}</Typography>
    </Box>
  );
}

/**
 * Species: headline figures, the cumulative discovery chart and per-species
 * seasonal counts for the selected species group, plus a sightings map for
 * orgs that record coordinates. Both charts are shared components
 * (CumulativeSpeciesChart, SpeciesOccurrenceChart) reused by Groups.
 * Device tracking lives on its own page (TrackingPage), not here.
 */
export function SpeciesPage() {
  // Heal doesn't record sighting coordinates, so the map is Cannwood-only.
  const isCannwood = getOrgSlug() === 'cannwood';

  // Species group (single selection drives both charts + the species picker)
  const [selectedSpeciesTypes, setSelectedSpeciesTypes] = useState<string[]>(['bird']);

  // Species selector state (for the occurrence chart)
  const [speciesList, setSpeciesList] = useState<SpeciesWithCount[]>([]);
  const [selectedSpeciesId, setSelectedSpeciesId] = useState<number | null>(null);

  // Sightings map state
  const [sightingsData, setSightingsData] = useState<SpeciesSightingLocation[]>([]);
  const [sightingsLoading, setSightingsLoading] = useState(false);
  const [sightingsError, setSightingsError] = useState<string | null>(null);

  // Field boundaries + which species types actually have entries
  const [locationsWithBoundaries, setLocationsWithBoundaries] = useState<LocationWithBoundary[]>([]);
  const [availableSpeciesTypes, setAvailableSpeciesTypes] = useState<string[]>([]);

  // Fetch the species list (ranked) when the species type changes; auto-select the top.
  useEffect(() => {
    const fetchSpecies = async () => {
      try {
        const species = await dashboardAPI.getSpeciesByCount(selectedSpeciesTypes[0]);
        setSpeciesList(species);
        setSelectedSpeciesId(species.length > 0 ? species[0].id : null);
      } catch (err) {
        console.error('Failed to fetch species list:', err);
        setSpeciesList([]);
        setSelectedSpeciesId(null);
      }
    };
    fetchSpecies();
  }, [selectedSpeciesTypes]);

  // Fetch all-time sightings for the selected species (for the map).
  // Heal doesn't record GPS coordinates on sightings, so the map section is
  // hidden for them and the fetch skipped.
  useEffect(() => {
    if (!selectedSpeciesId || !isCannwood) {
      setSightingsData([]);
      return;
    }
    let active = true;
    setSightingsLoading(true);
    setSightingsError(null);
    dashboardAPI
      .getSpeciesSightings(selectedSpeciesId)
      .then((res) => active && setSightingsData(res))
      .catch((err) => active && setSightingsError(err instanceof Error ? err.message : 'Failed to load sightings data'))
      .finally(() => active && setSightingsLoading(false));
    return () => {
      active = false;
    };
  }, [selectedSpeciesId, isCannwood]);

  // Field boundaries (once)
  useEffect(() => {
    locationsAPI
      .getAllWithBoundaries()
      .then(setLocationsWithBoundaries)
      .catch((err) => console.warn('Failed to load field boundaries:', err));
  }, []);

  // Species types that actually have entries (once)
  useEffect(() => {
    dashboardAPI
      .getSpeciesTypesWithEntries()
      .then((types) => {
        setAvailableSpeciesTypes(types);
        if (types.length > 0 && !types.includes(selectedSpeciesTypes[0])) {
          setSelectedSpeciesTypes([types[0]]);
        }
      })
      .catch((err) => {
        console.warn('Failed to load species types with entries:', err);
        setAvailableSpeciesTypes(speciesTypes);
      });
  }, []);

  const handleToggle = (type: string) => setSelectedSpeciesTypes([type]);

  return (
    <Box sx={{ p: SPACING.PAGE_PADDING }}>
      <PageTitle title="Species" />

      {/* Group filter: ONE row above the content, scrolling sideways rather
          than wrapping into a block of chips that ate the top of the page. */}
      <Box
        sx={{
          display: 'flex',
          gap: 1,
          mb: 2.5,
          overflowX: 'auto',
          pb: 0.5,
          mx: { xs: -1, sm: 0 },
          px: { xs: 1, sm: 0 },
          scrollbarWidth: 'none',
          '&::-webkit-scrollbar': { display: 'none' },
        }}
      >
        {speciesTypes
          .filter((type) => availableSpeciesTypes.includes(type))
          .sort((a, b) => getSpeciesDisplayName(a).localeCompare(getSpeciesDisplayName(b)))
          .map((type) => {
            const isSelected = selectedSpeciesTypes.includes(type);
            return (
              <ButtonBase
                key={type}
                onClick={() => handleToggle(type)}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.75,
                  px: 1.25,
                  py: 0.5,
                  borderRadius: '18px',
                  flexShrink: 0,
                  whiteSpace: 'nowrap',
                  bgcolor: isSelected ? brandColors.main : notionColors.gray.background,
                  color: isSelected ? '#fff' : 'text.primary',
                  fontSize: 13,
                  fontWeight: 600,
                  transition: 'all 0.15s',
                  '&:hover': { bgcolor: isSelected ? brandColors.hover : '#DDD' },
                }}
              >
                <SpeciesGroupIcon type={type} size={20} />
                {getSpeciesDisplayName(type)}
              </ButtonBase>
            );
          })}
      </Box>

      {/* Headline figures — one card, hero figure first (four bordered boxes
          read as heavy chrome for four small numbers, and their uppercase
          no-wrap labels truncated on phones). */}
      {(() => {
        const stats = groupStats(speciesList);
        return (
          <Paper
            elevation={0}
            sx={{
              p: { xs: 2.5, sm: 3 },
              mb: 3,
              border: '1px solid',
              borderColor: 'divider',
              display: 'grid',
              gridTemplateColumns: { xs: '1fr 1fr', md: 'auto 1px 1fr 1fr 1.2fr' },
              columnGap: { xs: 2, md: 3.5 },
              rowGap: 2.5,
              alignItems: 'start',
            }}
          >
            <Stat
              hero
              label={`${getSpeciesDisplayName(selectedSpeciesTypes[0])} recorded`}
              value={String(stats.species)}
            />
            <Box sx={{ display: { xs: 'none', md: 'block' }, alignSelf: 'stretch', bgcolor: 'divider' }} />
            <Stat label="Individuals recorded" value={stats.individuals.toLocaleString()} />
            <Stat label="New this year" value={String(stats.newThisYear)} />
            <Stat
              label="Latest addition"
              value={stats.latest ? (stats.latest.name ?? stats.latest.scientific_name ?? '—') : '—'}
              sub={
                stats.latest?.first_observed
                  ? dayjs(stats.latest.first_observed).format('D MMM YYYY')
                  : undefined
              }
            />
          </Paper>
        );
      })()}

      <Paper elevation={0} sx={{ p: { xs: 2.5, sm: 3 }, border: '1px solid', borderColor: 'divider' }}>
        <Typography variant="h6" sx={{ mb: 0.25, fontWeight: 600 }}>
          Species discovery
        </Typography>
        <Typography sx={{ fontSize: 13, color: 'text.secondary', mb: 2 }}>
          Unique {getSpeciesDisplayName(selectedSpeciesTypes[0]).toLowerCase()} recorded over time
        </Typography>
        <CumulativeSpeciesChart
          speciesTypes={[selectedSpeciesTypes[0]]}
          height={280}
          emptyMessage="No data available for selected species groups"
        />
      </Paper>

      <Paper elevation={0} sx={{ p: { xs: 2.5, sm: 3 }, mt: 3, border: '1px solid', borderColor: 'divider' }}>
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            alignItems: { xs: 'stretch', sm: 'flex-end' },
            justifyContent: 'space-between',
            gap: 2,
            mb: 2,
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h6" sx={{ mb: 0.25, fontWeight: 600 }}>
              Seasonal counts
            </Typography>
            <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
              Counts through the year, compared season on season
            </Typography>
          </Box>
          <Autocomplete
            options={speciesList}
            getOptionLabel={(option) =>
              `${option.name || option.scientific_name} (${option.total_count.toLocaleString()} individuals)`
            }
            value={speciesList.find((s) => s.id === selectedSpeciesId) || null}
            onChange={(_event, newValue) => setSelectedSpeciesId(newValue ? newValue.id : null)}
            renderInput={(params) => (
              <TextField {...params} label="Species" placeholder="Type to search..." size="small" />
            )}
            sx={{ width: { xs: '100%', sm: 300 }, flexShrink: 0 }}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            selectOnFocus
            clearOnBlur
            blurOnSelect
            autoHighlight
          />
        </Box>
        <SpeciesOccurrenceChart speciesId={selectedSpeciesId} height={280} />
      </Paper>

      {/* Sightings map — Cannwood only: Heal doesn't record GPS coordinates
          on sightings, so the map would always be empty. */}
      {isCannwood && (
        <Paper elevation={0} sx={{ p: { xs: 2.5, sm: 3 }, mt: 3, border: '1px solid', borderColor: 'divider' }}>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
            Sighting locations
          </Typography>
          {selectedSpeciesId ? (
            <SightingsMap
              sightings={sightingsData}
              loading={sightingsLoading}
              error={sightingsError}
              locationsWithBoundaries={locationsWithBoundaries}
            />
          ) : (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300, color: 'text.secondary' }}>
              <Typography variant="body1">Select a species to view sighting locations</Typography>
            </Box>
          )}
        </Paper>
      )}
    </Box>
  );
}
