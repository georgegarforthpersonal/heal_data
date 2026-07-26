/**
 * Per-survey seasonal count chart for a single species: each survey's count
 * plotted as a dot on a shared Jan–Dec axis, one colour per year, joined
 * only within a year — sparse/seasonal data stays honest (no line across
 * the winter gap) and seasons can be compared year-on-year. Zero counts are
 * real data: surveyed, none seen. Shared by the Dashboards page and the
 * Groups single-species panel — only height/chrome differ.
 */
import { Box, Paper, Typography } from '@mui/material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from 'recharts';
import dayjs from 'dayjs';
import type { SpeciesOccurrenceDataPoint } from '../../services/api';
import {
  buildMonthlyPeakSeries,
  buildSeasonalSeries,
  shouldAggregateMonthly,
  YEAR_SERIES_COLORS,
  type SeasonalRow,
} from '../groups/seasonalSeries';

interface SeasonalCountChartProps {
  data: SpeciesOccurrenceDataPoint[];
  /** A number of px, or '100%' to fill a parent of definite height. */
  height?: number | `${number}%`;
  /** Floor for a percentage height — a parent that resolves to 0 would
   *  otherwise render a 0×0 chart. */
  minHeight?: number;
  emptyMessage?: string;
}

export default function SeasonalCountChart({
  data,
  height = 240,
  minHeight,
  emptyMessage = 'No surveys recorded yet.',
}: SeasonalCountChartProps) {
  // Densely surveyed species (weekly bird counts) aggregate to monthly peak
  // counts — raw per-survey dots drown the seasonal shape in visit noise and
  // one 500-bird roost flattens everything else. Sparse programmes keep
  // per-survey dots: with eight visits a season, every dot IS the data.
  const monthly = shouldAggregateMonthly(data);
  const series = monthly ? buildMonthlyPeakSeries(data) : buildSeasonalSeries(data);

  // series.years is most-recent-first so the brand green lands on the current
  // season. Colour therefore binds to the YEAR, not to render order — lines,
  // legend and tooltip all read chronologically without repainting anything.
  const colourOf = (year: number) => YEAR_SERIES_COLORS[series ? series.years.indexOf(year) : 0];
  const chronological = series ? [...series.years].sort((a, b) => a - b) : [];

  if (!series) {
    return (
      <Box sx={{ height, minHeight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography sx={{ fontSize: 13.5, color: '#888' }}>{emptyMessage}</Typography>
      </Box>
    );
  }

  return (
    <>
      <ResponsiveContainer width="100%" height={height} minHeight={minHeight}>
        <LineChart data={series.rows} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#eceeec" />
          <XAxis
            dataKey="x"
            type="number"
            scale="time"
            domain={series.domain}
            ticks={series.monthTicks}
            tickFormatter={(t: number) => dayjs(t).format('MMM')}
            tick={{ fontSize: 12, fill: '#666' }}
            tickLine={false}
            axisLine={{ stroke: '#eceeec' }}
          />
          <YAxis
            width={32}
            allowDecimals={false}
            tick={{ fontSize: 11, fill: '#666' }}
            tickLine={false}
            axisLine={false}
          />
          <RechartsTooltip content={<SeasonTooltip monthly={monthly} />} />
          {chronological.map((year) => (
            <Line
              key={year}
              dataKey={String(year)}
              stroke={colourOf(year)}
              strokeWidth={2}
              connectNulls
              // 2px surface ring keeps dots legible where year-lines overlap.
              dot={{ r: 4, fill: colourOf(year), stroke: '#fff', strokeWidth: 2 }}
              activeDot={{ r: 6, stroke: '#fff', strokeWidth: 2 }}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
      {(series.years.length > 1 || monthly) && (
        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, flexWrap: 'wrap', mt: 1 }}>
          {series.years.length > 1 &&
            chronological.map((year) => (
              <Box key={year} sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: colourOf(year) }} />
                <Typography sx={{ fontSize: 12, color: '#666' }}>{year}</Typography>
              </Box>
            ))}
          {series.truncated && (
            <Typography sx={{ fontSize: 12, color: '#888' }}>earlier years not shown</Typography>
          )}
          {monthly && (
            <Typography sx={{ fontSize: 12, color: '#888' }}>peak count per month</Typography>
          )}
        </Box>
      )}
    </>
  );
}

interface SeasonTooltipProps {
  active?: boolean;
  label?: number;
  payload?: Array<{ dataKey?: string | number; value?: number | string; color?: string; payload: SeasonalRow }>;
  /** Monthly-peak mode: label the month, and the values as peaks. */
  monthly?: boolean;
}

function SeasonTooltip({ active, label, payload, monthly }: SeasonTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <Paper elevation={3} sx={{ p: 1.5, border: '1px solid', borderColor: 'divider' }}>
      <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: '#1a1a1a', mb: 0.5 }}>
        {monthly ? `${dayjs(label).format('MMMM')} · peak counts` : dayjs(label).format('D MMM')}
      </Typography>
      {payload.map((p) => (
        <Box key={String(p.dataKey)} sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: p.color }} />
          <Typography sx={{ fontSize: 12.5, color: '#666' }}>
            {p.dataKey}: {p.value}
          </Typography>
        </Box>
      ))}
    </Paper>
  );
}
