/**
 * Species panel for a group whose survey type is fixed to a single species
 * (e.g. Marsh Fritillary). A cumulative unique-species chart is meaningless
 * here, so instead the Chart view plots the count from each survey as a dot
 * on a shared Jan–Dec axis, one colour per year, joined only within a year —
 * sparse/seasonal data stays honest (no line across the winter gap) and
 * seasons can be compared year-on-year. The List view is the per-survey log.
 * Zero counts are real data: surveyed, none seen.
 */
import { useEffect, useState } from 'react';
import { Box, CircularProgress, Paper, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { BarChart as ChartIcon, ViewList } from '@mui/icons-material';
import dayjs from 'dayjs';
import { dashboardAPI, type Species, type SpeciesOccurrenceDataPoint } from '../../services/api';
import { groupCardSx, groupColors, panelTitleSx } from '../../pages/groups/groupsTokens';
import SeasonalCountChart from '../dashboard/SeasonalCountChart';

interface SingleSpeciesCountPanelProps {
  surveyTypeId: number;
  species: Species;
}

const CHART_HEIGHT = 240;

const headerCellSx = {
  fontSize: 11.5,
  fontWeight: 700,
  letterSpacing: 0.8,
  textTransform: 'uppercase',
  color: groupColors.textMuted,
} as const;

const listGridSx = {
  display: 'grid',
  gridTemplateColumns: '1fr 64px',
  gap: 1,
  px: 2.25,
} as const;

export default function SingleSpeciesCountPanel({ surveyTypeId, species }: SingleSpeciesCountPanelProps) {
  const [view, setView] = useState<'chart' | 'list'>('chart');
  const [data, setData] = useState<SpeciesOccurrenceDataPoint[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    setData(null);
    setError(false);
    dashboardAPI
      .getSpeciesOccurrences(species.id, undefined, undefined, surveyTypeId)
      .then((res) => active && setData(res.data))
      .catch(() => active && setError(true));
    return () => {
      active = false;
    };
  }, [species.id, surveyTypeId]);

  // Headline: all-time total individuals across every survey of this group.
  const totalCount = data?.reduce((sum, d) => sum + d.occurrence_count, 0) ?? 0;

  return (
    <Paper sx={groupCardSx}>
      <Box
        sx={{
          px: 2.25,
          py: 1.75,
          borderBottom: `1px solid ${groupColors.divider}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 1,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, minWidth: 0 }}>
          <Typography component="h2" sx={{ ...panelTitleSx, whiteSpace: 'nowrap' }}>
            Sighting count
          </Typography>
          <Typography
            sx={{ fontSize: 20, fontWeight: 700, color: groupColors.textPrimary, lineHeight: 1, flexShrink: 0 }}
          >
            {totalCount}
          </Typography>
        </Box>
        <ToggleButtonGroup
          value={view}
          exclusive
          size="small"
          onChange={(_, v) => v && setView(v)}
          sx={{
            bgcolor: '#f1f3f1',
            borderRadius: '7px',
            p: '3px',
            flexShrink: 0,
            '& .MuiToggleButton-root': {
              border: 'none',
              borderRadius: '5px !important',
              px: 1.25,
              py: 0.4,
              color: '#8a8a8a',
              textTransform: 'none',
              fontSize: 12.5,
              gap: 0.5,
            },
            '& .Mui-selected': {
              bgcolor: '#fff !important',
              color: `${groupColors.textPrimary} !important`,
              boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
            },
          }}
        >
          <ToggleButton value="chart">
            <ChartIcon sx={{ fontSize: 15 }} /> Chart
          </ToggleButton>
          <ToggleButton value="list">
            <ViewList sx={{ fontSize: 15 }} /> List
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {view === 'chart' && (
        <Box sx={{ p: 2.25 }}>
          {error ? (
            <CenteredMessage>Failed to load counts.</CenteredMessage>
          ) : data === null ? (
            <Box sx={{ height: CHART_HEIGHT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CircularProgress size={24} />
            </Box>
          ) : (
            <SeasonalCountChart data={data} height={CHART_HEIGHT} />
          )}
        </Box>
      )}

      {view === 'list' && (
        <Box>
          {error ? (
            <CenteredMessage>Failed to load counts.</CenteredMessage>
          ) : data === null ? (
            <CenteredMessage>Loading…</CenteredMessage>
          ) : data.length === 0 ? (
            <CenteredMessage>No surveys recorded yet.</CenteredMessage>
          ) : (
            <>
              <Box sx={{ ...listGridSx, py: 1 }}>
                <Typography sx={headerCellSx}>Survey</Typography>
                <Typography sx={{ ...headerCellSx, textAlign: 'right' }}>Count</Typography>
              </Box>
              <Box sx={{ maxHeight: 320, overflowY: 'auto' }}>
                {[...data].reverse().map((d) => (
                  <Box
                    key={d.survey_id}
                    sx={{
                      ...listGridSx,
                      alignItems: 'center',
                      py: 0.9,
                      borderTop: `1px solid ${groupColors.dividerInner}`,
                    }}
                  >
                    <Typography sx={{ fontSize: 13.5, color: groupColors.textPrimary }}>
                      {dayjs(d.survey_date).format('D MMM YYYY')}
                    </Typography>
                    <Typography
                      sx={{
                        fontSize: 13.5,
                        color: d.occurrence_count === 0 ? groupColors.textMuted : groupColors.textPrimary,
                        textAlign: 'right',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {d.occurrence_count}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </>
          )}
        </Box>
      )}
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

