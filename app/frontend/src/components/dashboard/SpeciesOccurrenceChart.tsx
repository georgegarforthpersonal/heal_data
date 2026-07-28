/**
 * Per-survey occurrence chart for a single species — the shared seasonal
 * Jan–Dec chart (one colour per year), same as the Groups single-species
 * panel, replacing the old ordinal bar chart that erased time gaps.
 *
 * Self-contained: fetches the occurrence series for a species id; the
 * caller owns the species picker and passes the chosen id.
 */
import { useEffect, useState } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import { dashboardAPI } from '../../services/api';
import type { SpeciesOccurrenceResponse } from '../../services/api';
import SeasonalCountChart from './SeasonalCountChart';

interface SpeciesOccurrenceChartProps {
  speciesId: number | null;
  height?: number;
}

export default function SpeciesOccurrenceChart({
  speciesId,
  height = 300,
}: SpeciesOccurrenceChartProps) {
  const [data, setData] = useState<SpeciesOccurrenceResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (speciesId == null) {
      setData(null);
      return;
    }
    let active = true;
    setLoading(true);
    setError(null);
    dashboardAPI
      .getSpeciesOccurrences(speciesId)
      .then((res) => active && setData(res))
      .catch((err) => active && setError(err instanceof Error ? err.message : 'Failed to load occurrence data'))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [speciesId]);

  const centeredSx = { height, display: 'flex', alignItems: 'center', justifyContent: 'center' } as const;

  if (speciesId == null) {
    return (
      <Box sx={centeredSx}>
        <Typography variant="body2" color="text.secondary">
          Select a species to view occurrences
        </Typography>
      </Box>
    );
  }
  if (loading) {
    return (
      <Box sx={centeredSx}>
        <CircularProgress size={24} />
      </Box>
    );
  }
  if (error) {
    return (
      <Box sx={centeredSx}>
        <Typography variant="body2" color="error">
          {error}
        </Typography>
      </Box>
    );
  }
  return (
    <SeasonalCountChart
      data={data?.data ?? []}
      height={height}
      emptyMessage="No occurrence data available"
    />
  );
}
