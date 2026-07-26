import { Box, Typography, Paper, Stack, ButtonBase, Autocomplete, TextField } from '@mui/material';
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

function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider', minWidth: 0 }}>
      <Typography sx={{ fontSize: 20, fontWeight: 700, lineHeight: 1.2 }} noWrap>
        {value}
      </Typography>
      {sub && (
        <Typography sx={{ fontSize: 12.5, color: 'text.secondary' }} noWrap>
          {sub}
        </Typography>
      )}
      <Typography sx={{ fontSize: 11.5, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5, mt: 0.25 }} noWrap>
        {label}
      </Typography>
    </Paper>
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
      {/* Species group chips — icon + name, the same visual language as
          the survey badges (placeholder tile where no badge exists yet).
          Unlabelled icon circles failed at a glance and had no labels at
          all on phones. */}
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 3 }}>
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
                  gap: 0.9,
                  px: 1.5,
                  py: 0.7,
                  borderRadius: '20px',
                  bgcolor: isSelected ? brandColors.main : notionColors.gray.background,
                  color: isSelected ? '#fff' : 'text.primary',
                  fontSize: 13.5,
                  fontWeight: 600,
                  transition: 'all 0.15s',
                  '&:hover': { bgcolor: isSelected ? brandColors.hover : '#DDD' },
                }}
              >
                <SpeciesGroupIcon type={type} size={22} />
                {getSpeciesDisplayName(type)}
              </ButtonBase>
            );
          })}
      </Stack>

      {/* Headline figures for the selected group */}
      {(() => {
        const stats = groupStats(speciesList);
        return (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' },
              gap: 2,
              mb: 3,
            }}
          >
            <StatTile label="Species recorded" value={String(stats.species)} />
            <StatTile label="Individuals recorded" value={stats.individuals.toLocaleString()} />
            <StatTile label="New species this year" value={String(stats.newThisYear)} />
            <StatTile
              label="Latest addition"
              value={stats.latest ? (stats.latest.name ?? stats.latest.scientific_name ?? '—') : '—'}
              sub={
                stats.latest?.first_observed
                  ? dayjs(stats.latest.first_observed).format('D MMM YYYY')
                  : undefined
              }
            />
              </Box>
            );
          })()}

          {/* Cumulative species chart */}
          <Paper elevation={0} sx={{ p: 3, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', minHeight: 500 }}>
            <Typography variant="h6" sx={{ mb: 0.25, fontWeight: 600 }}>
              Species discovery
            </Typography>
            <Typography sx={{ fontSize: 13, color: 'text.secondary', mb: 2 }}>
              Unique {getSpeciesDisplayName(selectedSpeciesTypes[0]).toLowerCase()} recorded over time
            </Typography>
            <CumulativeSpeciesChart
              speciesTypes={[selectedSpeciesTypes[0]]}
              height={400}
              emptyMessage="No data available for selected species groups"
            />
          </Paper>

          {/* Species occurrence chart */}
          <Paper elevation={0} sx={{ p: 3, mt: 3, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', minHeight: 400 }}>
            <Typography variant="h6" sx={{ mb: 0.25, fontWeight: 600 }}>
              Seasonal counts
            </Typography>
            <Typography sx={{ fontSize: 13, color: 'text.secondary', mb: 2 }}>
              Per-survey counts through the year, compared season on season
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 2 }}>
              <Autocomplete
                options={speciesList}
                getOptionLabel={(option) =>
                  `${option.name || option.scientific_name} (${option.total_count.toLocaleString()} individuals)`
                }
                value={speciesList.find((s) => s.id === selectedSpeciesId) || null}
                onChange={(_event, newValue) => setSelectedSpeciesId(newValue ? newValue.id : null)}
                renderInput={(params) => (
                  <TextField {...params} label="Select Species" placeholder="Type to search..." size="small" />
                )}
                sx={{ minWidth: { xs: '100%', sm: 300 } }}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                selectOnFocus
                clearOnBlur
                blurOnSelect
                autoHighlight
              />
            </Box>
            <SpeciesOccurrenceChart speciesId={selectedSpeciesId} height={300} />
          </Paper>

          {/* Sightings Map Section — Cannwood only: Heal doesn't record GPS
              coordinates on sightings, so the map would always be empty. */}
          {isCannwood && (
            <Paper elevation={0} sx={{ p: 3, mt: 3, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', minHeight: 400 }}>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                Sighting Locations
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
