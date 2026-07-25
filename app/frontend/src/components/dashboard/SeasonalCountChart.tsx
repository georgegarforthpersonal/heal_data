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
import { buildSeasonalSeries, YEAR_SERIES_COLORS, type SeasonalRow } from '../groups/seasonalSeries';

interface SeasonalCountChartProps {
  data: SpeciesOccurrenceDataPoint[];
  height?: number;
  emptyMessage?: string;
}

export default function SeasonalCountChart({
  data,
  height = 240,
  emptyMessage = 'No surveys recorded yet.',
}: SeasonalCountChartProps) {
  const series = buildSeasonalSeries(data);

  if (!series) {
    return (
      <Box sx={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography sx={{ fontSize: 13.5, color: '#888' }}>{emptyMessage}</Typography>
      </Box>
    );
  }

  return (
    <>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={series.rows} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e0e0e0" />
          <XAxis
            dataKey="x"
            type="number"
            scale="time"
            domain={series.domain}
            ticks={series.monthTicks}
            tickFormatter={(t: number) => dayjs(t).format('MMM')}
            tick={{ fontSize: 12, fill: '#666' }}
            tickLine={false}
            axisLine={{ stroke: '#e0e0e0' }}
          />
          <YAxis
            width={32}
            allowDecimals={false}
            tick={{ fontSize: 11, fill: '#666' }}
            tickLine={false}
            axisLine={false}
          />
          <RechartsTooltip content={<SeasonTooltip />} />
          {series.years.map((year, i) => (
            <Line
              key={year}
              dataKey={String(year)}
              stroke={YEAR_SERIES_COLORS[i]}
              strokeWidth={2}
              connectNulls
              dot={{ r: 3.5, fill: YEAR_SERIES_COLORS[i], strokeWidth: 0 }}
              activeDot={{ r: 5 }}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
      {series.years.length > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, flexWrap: 'wrap', mt: 1 }}>
          {series.years.map((year, i) => (
            <Box key={year} sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: YEAR_SERIES_COLORS[i] }} />
              <Typography sx={{ fontSize: 12, color: '#666' }}>{year}</Typography>
            </Box>
          ))}
          {series.truncated && (
            <Typography sx={{ fontSize: 12, color: '#888' }}>earlier years not shown</Typography>
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
}

function SeasonTooltip({ active, label, payload }: SeasonTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <Paper elevation={3} sx={{ p: 1.5, border: '1px solid', borderColor: 'divider' }}>
      <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: '#1a1a1a', mb: 0.5 }}>
        {dayjs(label).format('D MMM')}
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
