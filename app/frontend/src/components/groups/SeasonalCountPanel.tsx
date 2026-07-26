/**
 * "Seasonal counts" panel for a multi-species scheduled group (Bird,
 * Butterfly, Dragonfly). Same chart the single-species groups get, but with a
 * species picker in front of it: each survey's count for the chosen species
 * plotted on a shared Jan–Dec axis, one colour per year. Every figure is
 * scoped to THIS group's surveys, so a bird seen on an ad hoc walk doesn't
 * appear in the Bird programme's season.
 */
import { useEffect, useState } from 'react';
import {
  Autocomplete,
  Box,
  CircularProgress,
  Paper,
  TextField,
  Typography,
  createFilterOptions,
} from '@mui/material';
import {
  dashboardAPI,
  type SpeciesOccurrenceDataPoint,
  type SpeciesWithCount,
} from '../../services/api';
import { groupCardSx, groupColors } from '../../pages/groups/groupsTokens';
import SeasonalCountChart from '../dashboard/SeasonalCountChart';

interface SeasonalCountPanelProps {
  /** The group's survey type — every count comes from its surveys only. */
  surveyTypeId: number;
  /** The survey type's linked species types; empty = everything it recorded. */
  speciesTypes: string[];
}

const CHART_HEIGHT = 240;

/** Search by common OR scientific name (the input shows the common name). */
const filterSpecies = createFilterOptions<SpeciesWithCount>({
  stringify: (option) => `${option.name ?? ''} ${option.scientific_name ?? ''}`,
});

export default function SeasonalCountPanel({ surveyTypeId, speciesTypes }: SeasonalCountPanelProps) {
  const [species, setSpecies] = useState<SpeciesWithCount[] | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [data, setData] = useState<SpeciesOccurrenceDataPoint[] | null>(null);
  const [error, setError] = useState(false);

  // The group's species, most-recorded first — one call per linked species
  // type (a group can record several, e.g. bird + mammal), merged by count so
  // the picker opens on the species with the most to show.
  const typesKey = speciesTypes.join(',');
  useEffect(() => {
    let active = true;
    if (typesKey === '') {
      setSpecies([]);
      return;
    }
    Promise.all(typesKey.split(',').map((t) => dashboardAPI.getSpeciesByCount(t, surveyTypeId)))
      .then((perType) => {
        if (!active) return;
        const merged = perType.flat().sort((a, b) => b.total_count - a.total_count);
        setSpecies(merged);
        setSelectedId(merged[0]?.id ?? null);
      })
      .catch(() => active && setError(true));
    return () => {
      active = false;
    };
  }, [typesKey, surveyTypeId]);

  useEffect(() => {
    if (selectedId == null) return;
    let active = true;
    setData(null);
    dashboardAPI
      .getSpeciesOccurrences(selectedId, undefined, undefined, surveyTypeId)
      .then((res) => active && setData(res.data))
      .catch(() => active && setError(true));
    return () => {
      active = false;
    };
  }, [selectedId, surveyTypeId]);

  const selected = species?.find((s) => s.id === selectedId) ?? null;

  return (
    <Paper sx={groupCardSx}>
      <Box
        sx={{
          px: 2.25,
          py: 1.75,
          borderBottom: `1px solid ${groupColors.divider}`,
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          justifyContent: 'space-between',
          alignItems: { xs: 'stretch', sm: 'center' },
          gap: 1.25,
        }}
      >
        <Typography sx={{ fontSize: 15, fontWeight: 600, color: groupColors.textPrimary }} noWrap>
          Seasonal counts
        </Typography>
        {/* A species is always selected — clearing to "none" only empties the
            chart — so no clear (X); clicking opens the list and typing
            searches it, matching the Species page's picker. */}
        {selected ? (
          <Autocomplete
            options={species ?? []}
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
            value={selected}
            onChange={(_event, newValue) => setSelectedId(newValue.id)}
            renderInput={(params) => (
              <TextField {...params} label="Species" placeholder="Type to search..." size="small" />
            )}
            sx={{ width: { xs: '100%', sm: 220 }, flexShrink: 0 }}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            disableClearable
            openOnFocus
            selectOnFocus
            handleHomeEndKeys
            blurOnSelect
            autoHighlight
          />
        ) : null}
      </Box>

      <Box sx={{ p: 2.25 }}>
        {error ? (
          <CenteredMessage>Failed to load counts.</CenteredMessage>
        ) : species !== null && species.length === 0 ? (
          <CenteredMessage>No species recorded yet.</CenteredMessage>
        ) : data === null ? (
          <Box sx={{ height: CHART_HEIGHT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CircularProgress size={24} />
          </Box>
        ) : (
          <SeasonalCountChart data={data} height={CHART_HEIGHT} />
        )}
      </Box>
    </Paper>
  );
}

function CenteredMessage({ children }: { children: string }) {
  return (
    <Typography sx={{ fontSize: 13.5, color: groupColors.textMuted, px: 2.25, py: 3, textAlign: 'center' }}>
      {children}
    </Typography>
  );
}
