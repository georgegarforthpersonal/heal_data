import { Box, Typography, Paper, MenuItem, Autocomplete, TextField, createFilterOptions } from '@mui/material';
import { useState, useEffect } from 'react';
import dayjs from 'dayjs';
import { dashboardAPI, getOrgSlug } from '../services/api';
import type { SpeciesWithCount, SpeciesSightingLocation } from '../services/api';
import SightingsMap from '../components/dashboard/SightingsMap';
import CumulativeSpeciesChart from '../components/dashboard/CumulativeSpeciesChart';
import SpeciesOccurrenceChart from '../components/dashboard/SpeciesOccurrenceChart';
import SpeciesGroupIcon from '../components/dashboard/SpeciesGroupIcon';
import { speciesTypes, getSpeciesDisplayName } from '../config';
import { SPACING } from '../config/responsive';
import { PageTitle } from '../components/layout/PageTitle';

/** Search species by common OR scientific name (the input shows the common
 * name, so the scientific one would otherwise be unsearchable). */
const filterSpecies = createFilterOptions<SpeciesWithCount>({
  stringify: (option) => `${option.name ?? ''} ${option.scientific_name ?? ''}`,
});

/** Headline figures for the selected species group, all derived from the
 * ranked species list the page already fetches. */
function groupStats(speciesList: SpeciesWithCount[]) {
  const year = String(new Date().getFullYear());
  const individuals = speciesList.reduce((sum, s) => sum + s.total_count, 0);
  const newThisYear = speciesList.filter((s) => s.first_observed?.startsWith(year)).length;
  return { species: speciesList.length, individuals, newThisYear };
}

/** The newest species in the group, newest first — the discovery curve's steps
 * as plain text, so the dates something new turned up can be read off the page
 * instead of hunted for by dragging along the line. */
function newestSpecies(speciesList: SpeciesWithCount[], limit = 5) {
  return speciesList
    .filter((s) => s.first_observed)
    .sort((a, b) => (b.first_observed ?? '').localeCompare(a.first_observed ?? ''))
    .slice(0, limit);
}

/**
 * One figure in the stats band — value over a quiet sentence-case label, the
 * same shape the group cards use. Every figure is the SAME size: a 40px hero
 * beside 24px siblings read as an accident rather than a hierarchy, and these
 * are peers. Labels wrap (uppercase no-wrap truncated on phones).
 */
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography sx={{ fontSize: 26, fontWeight: 600, lineHeight: 1.2, overflowWrap: 'anywhere' }}>
        {value}
      </Typography>
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

  // Which species types actually have entries
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
  // Non-null selection lets the picker use disableClearable: clearing to
  // "no species" only empties the chart, so the X is a dead end.
  const selectedSpecies = speciesList.find((s) => s.id === selectedSpeciesId) ?? null;

  return (
    <Box sx={{ p: SPACING.PAGE_PADDING }}>
      <PageTitle title="Species" />

      {/* Group filter. A sideways-scrolling chip row hid its own overflow —
          nothing said "there's more". A dropdown is the conventional,
          self-evident control and keeps the badge artwork in its rows. */}
      <TextField
        select
        size="small"
        label="Species group"
        value={availableSpeciesTypes.includes(selectedSpeciesTypes[0]) ? selectedSpeciesTypes[0] : ''}
        onChange={(e) => handleToggle(e.target.value)}
        sx={{ width: { xs: '100%', sm: 260 }, mb: 3 }}
        SelectProps={{
          renderValue: (value) => (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <SpeciesGroupIcon type={value as string} size={20} />
              {getSpeciesDisplayName(value as string)}
            </Box>
          ),
        }}
      >
        {speciesTypes
          .filter((type) => availableSpeciesTypes.includes(type))
          .sort((a, b) => getSpeciesDisplayName(a).localeCompare(getSpeciesDisplayName(b)))
          .map((type) => (
            <MenuItem key={type} value={type} sx={{ gap: 1.25 }}>
              <SpeciesGroupIcon type={type} size={22} />
              {getSpeciesDisplayName(type)}
            </MenuItem>
          ))}
      </TextField>

      {/* Headline figures — one card, hero figure first (bordered boxes per
          figure read as heavy chrome for three small numbers, and their uppercase
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
              gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(3, 1fr)' },
              columnGap: { xs: 2, md: 3.5 },
              rowGap: 2.5,
              alignItems: 'start',
            }}
          >
            <Stat
              label={`${getSpeciesDisplayName(selectedSpeciesTypes[0])} recorded`}
              value={String(stats.species)}
            />
            <Stat label="Individuals recorded" value={stats.individuals.toLocaleString()} />
            <Stat label="New this year" value={String(stats.newThisYear)} />
            {/* No "latest addition" figure — the discovery chart's "Most
                recent additions" strip says it, with four more. */}
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
        {(() => {
          const newest = newestSpecies(speciesList);
          if (newest.length === 0) return null;
          return (
            <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
              <Typography sx={{ fontSize: 12.5, color: 'text.secondary', mb: 1 }}>
                Most recent additions
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: { xs: 1, sm: 2 } }}>
                {newest.map((s) => (
                  <Box
                    key={s.id}
                    sx={{
                      display: 'flex',
                      alignItems: 'baseline',
                      gap: 0.75,
                      px: 1.25,
                      py: 0.6,
                      borderRadius: 1.5,
                      bgcolor: 'action.hover',
                      minWidth: 0,
                    }}
                  >
                    <Typography sx={{ fontSize: 13, fontWeight: 500 }} noWrap>
                      {s.name ?? s.scientific_name ?? 'Unknown'}
                    </Typography>
                    <Typography sx={{ fontSize: 12, color: 'text.secondary', flexShrink: 0 }}>
                      {dayjs(s.first_observed).format('D MMM YY')}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          );
        })()}
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
          {/* A species is always selected — clearing to "none" only empties
              the chart, so there's no clear (X). Clicking opens the list
              (it behaves like a dropdown that also accepts typing); the
              input holds just the name, with the count in the option rows,
              so the select-on-focus highlight is a word, not a sentence. */}
          {selectedSpecies ? (
          <Autocomplete
            options={speciesList}
            getOptionLabel={(option) => option.name || option.scientific_name || ''}
            filterOptions={filterSpecies}
            renderOption={({ key, ...props }, option) => (
              <Box
                component="li"
                key={key}
                {...props}
                sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}
              >
                <span>{option.name || option.scientific_name}</span>
                <Typography component="span" sx={{ fontSize: 12.5, color: 'text.secondary' }}>
                  {option.total_count.toLocaleString()}
                </Typography>
              </Box>
            )}
            value={selectedSpecies}
            onChange={(_event, newValue) => setSelectedSpeciesId(newValue.id)}
            renderInput={(params) => (
              <TextField {...params} label="Species" placeholder="Type to search..." size="small" />
            )}
            sx={{ width: { xs: '100%', sm: 300 }, flexShrink: 0 }}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            disableClearable
            openOnFocus
            selectOnFocus
            handleHomeEndKeys
            blurOnSelect
            autoHighlight
          />
          ) : (
            <TextField
              label="Species"
              size="small"
              value=""
              placeholder="No species recorded"
              disabled
              sx={{ width: { xs: '100%', sm: 300 }, flexShrink: 0 }}
            />
          )}
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
          {/* No locationsWithBoundaries: the field outlines competed with the
              sightings themselves, which are the point of this map. */}
          {selectedSpeciesId ? (
            <SightingsMap
              sightings={sightingsData}
              loading={sightingsLoading}
              error={sightingsError}
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
