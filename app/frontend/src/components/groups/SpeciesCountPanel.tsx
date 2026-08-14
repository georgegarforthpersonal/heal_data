/**
 * "Species count" panel for a group: a headline count with a Chart/List
 * toggle (same control as the Locations & devices panel's Map/List). Chart
 * is the shared all-time cumulative-species area chart; List is every
 * species identified with its occurrence count and the date it was first
 * observed, newest discovery first (the caption says so — an unlabelled
 * sort reads as random). A failed list fetch says it failed, with Retry —
 * never "no species yet".
 */
import { useCallback, useEffect, useState } from 'react';
import { Box, Button, Paper, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { BarChart as ChartIcon, ViewList } from '@mui/icons-material';
import dayjs from 'dayjs';
import { dashboardAPI, type SpeciesWithCount } from '../../services/api';
import CumulativeSpeciesChart, { type CumulativeSummary } from '../dashboard/CumulativeSpeciesChart';
import { groupCardSx, groupColors, linkButtonSx, panelTitleSx, viewToggleSx } from '../../pages/groups/groupsTokens';

interface SpeciesCountPanelProps {
  /** The survey type's linked species types; empty = count everything it recorded. */
  speciesTypes: string[];
  /** The group's survey type — counts only cover this type's surveys. */
  surveyTypeId: number;
}

const headerCellSx = {
  fontSize: 11.5,
  fontWeight: 700,
  letterSpacing: 0.8,
  textTransform: 'uppercase',
  color: groupColors.textMuted,
} as const;

// Fixed number columns, fluid name column; tighter on phones so species
// names keep the majority of a 320px row.
const listGridSx = {
  display: 'grid',
  gridTemplateColumns: { xs: 'minmax(0, 1fr) 52px 84px', sm: 'minmax(0, 1fr) 64px 96px' },
  gap: 1,
  px: 2.25,
} as const;

export default function SpeciesCountPanel({ speciesTypes, surveyTypeId }: SpeciesCountPanelProps) {
  const [summary, setSummary] = useState<CumulativeSummary | null>(null);
  const [view, setView] = useState<'chart' | 'list'>('chart');
  const [species, setSpecies] = useState<SpeciesWithCount[] | null>(null);
  const [listError, setListError] = useState(false);
  const [listAttempt, setListAttempt] = useState(0);

  // Fetch the per-species breakdown the first time the list is shown — one
  // call per species type actually present in the data (the chart's summary
  // reports them), merged into a single newest-discovery-first list.
  useEffect(() => {
    if (view !== 'list' || species !== null || !summary || summary.types.length === 0) return;
    let active = true;
    setListError(false);
    Promise.all(summary.types.map((t) => dashboardAPI.getSpeciesByCount(t, surveyTypeId)))
      .then((perType) => {
        if (!active) return;
        // Newest discovery first; species with no date (shouldn't happen for
        // recorded species) sink to the bottom.
        setSpecies(
          perType
            .flat()
            .sort((a, b) => (b.first_observed ?? '').localeCompare(a.first_observed ?? '')),
        );
      })
      .catch(() => active && setListError(true));
    return () => {
      active = false;
    };
  }, [view, species, summary, surveyTypeId, listAttempt]);

  const retryList = useCallback(() => {
    setListError(false);
    setListAttempt((n) => n + 1);
  }, []);

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
          <Typography component="h2" sx={panelTitleSx}>
            Species count
          </Typography>
          <Typography sx={{ fontSize: 20, fontWeight: 700, color: groupColors.textPrimary, lineHeight: 1 }}>
            {/* Never flash a fake 0 while the chart's fetch is in flight. */}
            {summary === null ? '—' : summary.total}
          </Typography>
        </Box>
        <ToggleButtonGroup
          value={view}
          exclusive
          size="small"
          aria-label="Species count view"
          onChange={(_, v) => v && setView(v)}
          sx={viewToggleSx}
        >
          <ToggleButton value="chart">
            <ChartIcon sx={{ fontSize: 15 }} /> Chart
          </ToggleButton>
          <ToggleButton value="list">
            <ViewList sx={{ fontSize: 15 }} /> List
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* The chart stays mounted (hidden) while the list is shown so its
          summary keeps feeding the headline count. */}
      <Box sx={{ p: 2.25, display: view === 'chart' ? 'block' : 'none' }}>
        <CumulativeSpeciesChart
          speciesTypes={speciesTypes}
          surveyTypeId={surveyTypeId}
          color={groupColors.brand}
          height={240}
          emptyMessage="No species recorded yet"
          onSummary={setSummary}
        />
      </Box>

      {view === 'list' && (
        <Box>
          {listError ? (
            <Box sx={{ px: 2.25, py: 3, display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Typography sx={{ fontSize: 13.5, color: groupColors.textMuted }}>
                Couldn’t load the species list.
              </Typography>
              <Button size="small" onClick={retryList} sx={linkButtonSx}>
                Retry
              </Button>
            </Box>
          ) : species === null ? (
            <Typography sx={{ fontSize: 13.5, color: groupColors.textMuted, px: 2.25, py: 3 }}>
              Loading…
            </Typography>
          ) : species.length === 0 ? (
            <Typography sx={{ fontSize: 13.5, color: groupColors.textMuted, px: 2.25, py: 3 }}>
              No species recorded yet.
            </Typography>
          ) : (
            <>
              <Box sx={{ ...listGridSx, py: 1 }}>
                <Typography sx={headerCellSx}>Species · newest first</Typography>
                <Typography sx={{ ...headerCellSx, textAlign: 'right' }}>Total</Typography>
                <Typography sx={{ ...headerCellSx, textAlign: 'right' }}>First seen</Typography>
              </Box>
              {/* No inner scroll on phones — nested scroll regions trap the
                  page's own scroll under a thumb. */}
              <Box sx={{ maxHeight: { xs: 'none', sm: 320 }, overflowY: { xs: 'visible', sm: 'auto' } }}>
                {species.map((s) => (
                  <Box
                    key={s.id}
                    sx={{
                      ...listGridSx,
                      alignItems: 'center',
                      py: 0.9,
                      borderTop: `1px solid ${groupColors.dividerInner}`,
                    }}
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontSize: 13.5, color: groupColors.textPrimary }} noWrap>
                        {s.name ?? s.scientific_name ?? 'Unknown'}
                      </Typography>
                      {s.name && s.scientific_name && (
                        <Typography
                          sx={{ fontSize: 11.5, color: groupColors.textMuted, fontStyle: 'italic' }}
                          noWrap
                        >
                          {s.scientific_name}
                        </Typography>
                      )}
                    </Box>
                    <Typography
                      sx={{
                        fontSize: 13.5,
                        color: groupColors.textPrimary,
                        textAlign: 'right',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {s.total_count}
                    </Typography>
                    <Typography sx={{ fontSize: 12.5, color: groupColors.textMuted, textAlign: 'right' }}>
                      {s.first_observed ? dayjs(s.first_observed).format('D MMM YYYY') : '—'}
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
