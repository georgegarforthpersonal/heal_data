import { Box, Typography, Paper, Stack, IconButton, Tooltip, CircularProgress, Alert, Select, MenuItem, FormControl, InputLabel } from '@mui/material';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip as RechartsTooltip, BarChart, Bar } from 'recharts';
import { useState, useEffect } from 'react';
import dayjs from 'dayjs';
import { dashboardAPI } from '../services/api';
import type { CumulativeSpeciesResponse, SpeciesWithCount, SpeciesOccurrenceResponse } from '../services/api';
import { ButterflyIcon, BirdIcon, MushroomIcon, SpiderIcon, BatIcon, MammalIcon, ReptileIcon, AmphibianIcon, MothIcon, BugIcon, LeafIcon } from '../components/icons/WildlifeIcons';
import { notionColors } from '../theme';

/**
 * DashboardsPage displays cumulative species count charts
 *
 * Features:
 * - Multi-select species group filter using icon toggles (default: bird)
 * - Cumulative unique species count chart (LineChart from @mui/x-charts)
 * - Different colored line per selected species group
 * - Responsive design with Notion-inspired styling
 */
export function DashboardsPage() {
  // ============================================================================
  // State Management
  // ============================================================================

  const [selectedSpeciesTypes, setSelectedSpeciesTypes] = useState<string[]>(['bird']); // Default: bird selected
  const [chartData, setChartData] = useState<CumulativeSpeciesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Species selector state
  const [speciesList, setSpeciesList] = useState<SpeciesWithCount[]>([]);
  const [selectedSpeciesId, setSelectedSpeciesId] = useState<number | null>(null);
  const [occurrenceData, setOccurrenceData] = useState<SpeciesOccurrenceResponse | null>(null);
  const [occurrenceLoading, setOccurrenceLoading] = useState(false);
  const [occurrenceError, setOccurrenceError] = useState<string | null>(null);

  // ============================================================================
  // Species Type Configuration
  // ============================================================================

  const speciesTypes = [
    'butterfly',
    'bird',
    'moth',
    'insect',
    'gall',
    'spider',
    'bat',
    'mammal',
    'reptile',
    'amphibian',
    'fungi'
  ];

  // Map species types to icon components
  const getSpeciesIcon = (type: string) => {
    switch (type) {
      case 'butterfly': return ButterflyIcon;
      case 'bird': return BirdIcon;
      case 'moth': return MothIcon;
      case 'insect': return BugIcon;
      case 'gall': return LeafIcon;
      case 'spider': return SpiderIcon;
      case 'bat': return BatIcon;
      case 'mammal': return MammalIcon;
      case 'reptile': return ReptileIcon;
      case 'amphibian': return AmphibianIcon;
      case 'fungi': return MushroomIcon;
      default: return BugIcon;
    }
  };

  // Chart configuration constants
  const HEAL_PURPLE = '#8B8AC7';
  const CHART_MARGIN = { top: 10, right: 10, left: 0, bottom: 0 };

  // Format species type name for display
  const formatTypeName = (type: string): string => {
    return type.charAt(0).toUpperCase() + type.slice(1) + 's';
  };

  // Format timestamp for x-axis (Year for Jan, Month name for Apr/Jul/Oct)
  const formatXAxisTick = (timestamp: number): string => {
    const d = dayjs(timestamp);
    const month = d.month();
    return month === 0 ? d.format('YYYY') : d.format('MMM');
  };

  // Custom tooltip component for chart hover
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || payload.length === 0) {
      return null;
    }

    const data = payload[0].payload;
    const date = dayjs(data.date).format('MMM DD, YYYY');

    // Get the current species type and its new species
    const currentType = selectedSpeciesTypes[0];
    const newSpeciesList = data.newSpecies?.[currentType] || [];
    const count = data[currentType] || 0;

    return (
      <Paper
        elevation={3}
        sx={{
          p: 2,
          bgcolor: 'background.paper',
          border: '1px solid',
          borderColor: 'divider',
          maxWidth: 300,
        }}
      >
        <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
          {date}
        </Typography>
        <Typography variant="body2" sx={{ mb: 1 }}>
          Total: {count} {formatTypeName(currentType).toLowerCase()}
        </Typography>

        {newSpeciesList.length > 0 && (
          <>
            <Typography variant="body2" sx={{ fontWeight: 600, mt: 1.5, mb: 0.5 }}>
              New this week:
            </Typography>
            <Box sx={{ maxHeight: 150, overflowY: 'auto' }}>
              {newSpeciesList.map((species, idx) => (
                <Typography key={idx} variant="body2" sx={{ fontSize: '0.875rem', color: 'text.secondary' }}>
                  • {species}
                </Typography>
              ))}
            </Box>
          </>
        )}

        {newSpeciesList.length === 0 && (
          <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
            No new species this week
          </Typography>
        )}
      </Paper>
    );
  };

  // ============================================================================
  // Data Fetching
  // ============================================================================

  // Fetch cumulative species data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await dashboardAPI.getCumulativeSpecies(selectedSpeciesTypes);
        setChartData(response);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedSpeciesTypes]);

  // Fetch species list when species type changes
  useEffect(() => {
    const fetchSpecies = async () => {
      try {
        const currentType = selectedSpeciesTypes[0];
        const species = await dashboardAPI.getSpeciesByCount(currentType);
        setSpeciesList(species);

        // Auto-select most common species (first in list)
        if (species.length > 0) {
          setSelectedSpeciesId(species[0].id);
        } else {
          setSelectedSpeciesId(null);
        }
      } catch (err) {
        console.error('Failed to fetch species list:', err);
        setSpeciesList([]);
        setSelectedSpeciesId(null);
      }
    };

    fetchSpecies();
  }, [selectedSpeciesTypes]);

  // Fetch occurrence data when species is selected
  useEffect(() => {
    const fetchOccurrences = async () => {
      if (!selectedSpeciesId) {
        setOccurrenceData(null);
        return;
      }

      try {
        setOccurrenceLoading(true);
        setOccurrenceError(null);

        // Use same date range as cumulative chart if available
        const startDate = chartData?.date_range.start;
        const endDate = chartData?.date_range.end;

        const response = await dashboardAPI.getSpeciesOccurrences(
          selectedSpeciesId,
          startDate,
          endDate
        );
        setOccurrenceData(response);
      } catch (err) {
        setOccurrenceError(err instanceof Error ? err.message : 'Failed to load occurrence data');
      } finally {
        setOccurrenceLoading(false);
      }
    };

    fetchOccurrences();
  }, [selectedSpeciesId, chartData?.date_range]);

  // ============================================================================
  // Event Handlers
  // ============================================================================

  const handleToggle = (type: string) => {
    // Only allow one species type at a time
    setSelectedSpeciesTypes([type]);
  };

  // ============================================================================
  // Chart Data Transformation
  // ============================================================================

  const prepareChartData = () => {
    if (!chartData || chartData.data.length === 0) {
      return null;
    }

    // Get all species types present in the data
    const types = Array.from(new Set(chartData.data.map(d => d.type)));

    // Get start of week (Monday) using dayjs
    const getWeekStart = (date: Date): string =>
      dayjs(date).startOf('week').add(1, 'day').format('YYYY-MM-DD');

    // Aggregate data by week
    const weeklyData = new Map<string, { counts: { [key: string]: number }; species: { [key: string]: string[] } }>();

    chartData.data.forEach(({ date, type, cumulative_count, new_species }) => {
      const weekKey = getWeekStart(new Date(date));

      if (!weeklyData.has(weekKey)) {
        weeklyData.set(weekKey, { counts: {}, species: {} });
      }

      const weekData = weeklyData.get(weekKey)!;

      // Take the max cumulative count for each type within the week
      weekData.counts[type] = Math.max(weekData.counts[type] || 0, cumulative_count);

      // Collect all new species for this type in this week
      if (!weekData.species[type]) {
        weekData.species[type] = [];
      }
      weekData.species[type].push(...new_species);
    });

    // Convert to array format with timestamps for x-axis
    const chartArray = Array.from(weeklyData.entries())
      .map(([weekKey, data]) => {
        // Deduplicate species names for each type
        const deduplicatedSpecies: { [key: string]: string[] } = {};
        Object.entries(data.species).forEach(([type, speciesList]) => {
          deduplicatedSpecies[type] = Array.from(new Set(speciesList));
        });

        return {
          date: new Date(weekKey).getTime(),
          ...data.counts,
          newSpecies: deduplicatedSpecies, // Store as nested object by type
        };
      })
      .sort((a, b) => a.date - b.date);

    // Calculate custom ticks for x-axis (Year in Jan, then Apr, Jul, Oct)
    const customTicks: Date[] = [];
    const seenMonths = new Set<string>();

    chartArray.forEach(item => {
      const date = new Date(item.date);
      const month = date.getMonth(); // 0-11
      const year = date.getFullYear();
      const key = `${year}-${month}`;

      // Only add tick for Jan (year), Apr, Jul, Oct - once per month
      if ((month === 0 || month === 3 || month === 6 || month === 9) && !seenMonths.has(key)) {
        customTicks.push(date);
        seenMonths.add(key);
      }
    });

    return {
      data: chartArray,
      types,
      customTicks,
    };
  };

  const chartDataPrepared = prepareChartData();

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <Box sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
      {/* Species Group Selector */}
      <Paper
        elevation={0}
        sx={{
          p: 2,
          mb: 3,
          bgcolor: 'background.paper',
          border: '1px solid',
          borderColor: 'divider'
        }}
      >
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {speciesTypes.map(type => {
            const Icon = getSpeciesIcon(type);
            const isSelected = selectedSpeciesTypes.includes(type);

            return (
              <Tooltip key={type} title={formatTypeName(type)} arrow>
                <IconButton
                  onClick={() => handleToggle(type)}
                  sx={{
                    bgcolor: isSelected ? HEAL_PURPLE : notionColors.gray.background,
                    color: isSelected ? '#fff' : 'text.secondary',
                    width: 40,
                    height: 40,
                    '&:hover': {
                      bgcolor: isSelected ? '#7A79B6' : '#DDD',
                    },
                    transition: 'all 0.2s',
                    border: isSelected ? '2px solid #7A79B6' : 'none',
                  }}
                >
                  <Icon sx={{ fontSize: '20px' }} />
                </IconButton>
              </Tooltip>
            );
          })}
        </Stack>
      </Paper>

      {/* Chart Section */}
      <Paper
        elevation={0}
        sx={{
          p: 3,
          bgcolor: 'background.paper',
          border: '1px solid',
          borderColor: 'divider',
          minHeight: 500
        }}
      >
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
            <CircularProgress />
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {!loading && !error && chartDataPrepared && chartDataPrepared.types.length > 0 && (
          <ResponsiveContainer width="100%" height={400}>
            <AreaChart data={chartDataPrepared.data} margin={CHART_MARGIN}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e0e0e0" />
              <XAxis
                dataKey="date"
                type="number"
                domain={['dataMin', 'dataMax']}
                scale="time"
                ticks={chartDataPrepared.customTicks.map(d => d.getTime())}
                tickFormatter={formatXAxisTick}
                tick={{ fontSize: 12, fill: '#666' }}
                tickLine={false}
                axisLine={{ stroke: '#e0e0e0' }}
              />
              <YAxis
                tick={{ fontSize: 12, fill: '#666' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => value.toLocaleString()}
              />
              <RechartsTooltip content={<CustomTooltip />} />
              {chartDataPrepared.types.map(type => (
                <Area
                  key={type}
                  type="monotone"
                  dataKey={type}
                  stroke={HEAL_PURPLE}
                  fill={HEAL_PURPLE}
                  fillOpacity={0.6}
                  strokeWidth={2}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        )}

        {!loading && !error && (!chartDataPrepared || chartDataPrepared.types.length === 0) && (
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              minHeight: 400,
              color: 'text.secondary'
            }}
          >
            <Typography variant="body1">
              No data available for selected species groups
            </Typography>
          </Box>
        )}
      </Paper>

      {/* Species Occurrence Chart */}
      <Paper
        elevation={0}
        sx={{
          p: 3,
          bgcolor: 'background.paper',
          border: '1px solid',
          borderColor: 'divider',
          minHeight: 400
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 2 }}>
          <FormControl size="small" sx={{ minWidth: 300 }}>
            <InputLabel id="species-select-label">Select Species</InputLabel>
            <Select
              labelId="species-select-label"
              value={selectedSpeciesId || ''}
              label="Select Species"
              onChange={(e) => setSelectedSpeciesId(Number(e.target.value))}
            >
              {speciesList.map((species) => (
                <MenuItem key={species.id} value={species.id}>
                  {species.name || species.scientific_name} ({species.total_count} total)
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        {occurrenceLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
            <CircularProgress />
          </Box>
        )}

        {occurrenceError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {occurrenceError}
          </Alert>
        )}

        {!occurrenceLoading && !occurrenceError && occurrenceData && chartDataPrepared && (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={(() => {
                // Create a map of week_start -> count from occurrence data
                const occurrenceMap = new Map<number, number>();
                occurrenceData.data.forEach(d => {
                  occurrenceMap.set(new Date(d.week_start).getTime(), d.occurrence_count);
                });

                // Use the same data points as the cumulative chart to ensure matching x-axis
                return chartDataPrepared.data.map(d => ({
                  date: d.date,
                  count: occurrenceMap.get(d.date) || 0,
                }));
              })()}
              margin={CHART_MARGIN}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e0e0e0" />
              <XAxis
                dataKey="date"
                type="number"
                domain={['dataMin', 'dataMax']}
                scale="time"
                ticks={chartDataPrepared.customTicks.map(d => d.getTime())}
                tickFormatter={formatXAxisTick}
                tick={{ fontSize: 12, fill: '#666' }}
                tickLine={false}
                axisLine={{ stroke: '#e0e0e0' }}
              />
              <YAxis
                tick={{ fontSize: 12, fill: '#666' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => value.toLocaleString()}
              />
              <RechartsTooltip
                content={({ active, payload }) => {
                  if (!active || !payload || payload.length === 0) return null;
                  const data = payload[0].payload;
                  const date = dayjs(data.date).format('MMM DD, YYYY');
                  return (
                    <Paper
                      elevation={3}
                      sx={{
                        p: 2,
                        bgcolor: 'background.paper',
                        border: '1px solid',
                        borderColor: 'divider',
                      }}
                    >
                      <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                        {date}
                      </Typography>
                      <Typography variant="body2">
                        Count: {data.count} individuals
                      </Typography>
                    </Paper>
                  );
                }}
              />
              <Bar dataKey="count" fill={HEAL_PURPLE} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}

        {!occurrenceLoading && !occurrenceError && (!occurrenceData || !chartDataPrepared) && (
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              minHeight: 300,
              color: 'text.secondary'
            }}
          >
            <Typography variant="body1">
              {selectedSpeciesId ? 'Loading chart data...' : 'Select a species to view occurrences'}
            </Typography>
          </Box>
        )}
      </Paper>
    </Box>
  );
}
