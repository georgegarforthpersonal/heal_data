import { Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, Stack, Button, Avatar, AvatarGroup, Tooltip, CircularProgress, Alert, Snackbar } from '@mui/material';
import { CalendarToday, Person, Visibility, LocationOn, Assignment } from '@mui/icons-material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ButterflyIcon, BirdIcon, MushroomIcon } from '../components/icons/WildlifeIcons';
import { notionColors, tableSizing } from '../theme';
import { useState, useEffect, useRef } from 'react';
import { surveysAPI, surveyorsAPI, locationsAPI } from '../services/api';
import type { Survey, Surveyor, Location } from '../services/api';

/**
 * SurveysPage displays a table of wildlife surveys with:
 * - Date, surveyors (avatar stack), species breakdown (chips with icons), and type
 * - Notion-style design with clean, minimal aesthetics
 * - Clickable rows that navigate to survey detail pages
 *
 * Species Breakdown Feature:
 * - Each survey shows species_breakdown from the API (e.g., [{type: "bird", count: 20}])
 * - Icons automatically displayed based on species type:
 *   - butterfly → ButterflyIcon (🦋)
 *   - bird → BirdIcon (🐦)
 *   - fungi → MushroomIcon (🍄)
 * - Supports multiple species per survey (e.g., "🦋45 🐦23 🍄18")
 * - Note: survey.type field is deprecated, use species_breakdown instead
 *
 * Following DEVELOPMENT.md conventions:
 * - Built inline first (no premature component extraction)
 * - Uses MUI components with theme integration
 * - Connected to real API (src/services/api.ts)
 */
export function SurveysPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // ============================================================================
  // State Management
  // ============================================================================

  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [surveyors, setSurveyors] = useState<Surveyor[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [createdSurveyId, setCreatedSurveyId] = useState<number | null>(null);
  const createdRowRef = useRef<HTMLTableRowElement>(null);
  const hasProcessedCreation = useRef(false);

  // ============================================================================
  // Data Fetching
  // ============================================================================

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch surveys, surveyors, and locations in parallel
        const [surveysData, surveyorsData, locationsData] = await Promise.all([
          surveysAPI.getAll(),
          surveyorsAPI.getAll(),
          locationsAPI.getAll(),
        ]);

        setSurveys(surveysData);
        setSurveyors(surveyorsData);
        setLocations(locationsData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load surveys');
        console.error('Error fetching data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // ============================================================================
  // Handle newly created survey toast and highlighting
  // ============================================================================

  useEffect(() => {
    const createdParam = searchParams.get('created');
    if (createdParam && surveys.length > 0 && !hasProcessedCreation.current) {
      const surveyId = parseInt(createdParam);

      // Mark as processed to prevent re-running
      hasProcessedCreation.current = true;

      // Set state for highlighting and toast
      setCreatedSurveyId(surveyId);
      setShowSuccessToast(true);

      // Clear URL parameter immediately to prevent re-trigger on refresh
      setSearchParams({}, { replace: true });

      // Scroll to the newly created row
      setTimeout(() => {
        createdRowRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }, 100);

      // Clear highlighting after 3 seconds
      setTimeout(() => {
        setCreatedSurveyId(null);
        hasProcessedCreation.current = false; // Reset for next creation
      }, 3000);
    }
  }, [searchParams, surveys, setSearchParams]);

  // ============================================================================
  // Event Handlers
  // ============================================================================

  const handleRowClick = (surveyId: number) => {
    navigate(`/surveys/${surveyId}`);
  };

  const handleCreateClick = () => {
    navigate('/surveys/new');
  };

  // ============================================================================
  // Helper Functions
  // ============================================================================

  /**
   * Get surveyor name from ID
   */
  const getSurveyorName = (id: number): string => {
    const surveyor = surveyors.find(s => s.id === id);
    if (!surveyor) return 'Unknown';
    return `${surveyor.first_name} ${surveyor.last_name}`.trim() || surveyor.first_name;
  };

  /**
   * Get location name from ID
   */
  const getLocationName = (id: number): string => {
    const location = locations.find(l => l.id === id);
    return location?.name || 'Unknown';
  };

  /**
   * Extracts initials from a full name (e.g., "John Smith" → "JS")
   */
  const getInitials = (name: string): string => {
    const parts = name.trim().split(' ').filter(p => p.length > 0);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    if (parts.length === 1 && parts[0].length > 0) {
      return parts[0][0].toUpperCase();
    }
    return '?';
  };

  /**
   * Format date from YYYY-MM-DD to readable format
   */
  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // ============================================================================
  // Render
  // ============================================================================

  // Show loading state
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  // Show error state
  if (error) {
    return (
      <Box sx={{ p: 4 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Button variant="contained" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 4 }}>
      {/* Page Header - Notion-style with icon and title */}
      <Box sx={{ mb: 3 }}>
        <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
          <Assignment sx={{ fontSize: 40, color: 'text.secondary' }} />
          <Typography
            variant="h1"
            sx={{
              fontSize: '2.5rem',
              fontWeight: 700,
              color: 'text.primary'
            }}
          >
            Surveys
          </Typography>
        </Stack>

        {/* Actions - New survey button */}
        {/* TODO: Add RBAC permission check - only show this button to admin users */}
        {/* When implementing: const { hasPermission } = useAuth(); */}
        {/* Then conditionally render: {hasPermission('create_survey') && <Button.../>} */}
        <Stack direction="row" justifyContent="flex-end" alignItems="center">
          <Button
            variant="contained"
            size="medium"
            onClick={handleCreateClick}
            sx={{
              textTransform: 'none',
              fontWeight: 600,
              boxShadow: 'none',
              '&:hover': { boxShadow: 'none' }
            }}
          >
            New
          </Button>
        </Stack>
      </Box>

      {/* Surveys Table */}
      <TableContainer
        component={Paper}
        sx={{
          boxShadow: 'none',
          border: '1px solid',
          borderColor: 'divider'
        }}
      >
        <Table sx={{ minWidth: 650 }}>
          {/* Table Header */}
          <TableHead>
            <TableRow sx={{ bgcolor: 'grey.50' }}>
              <TableCell
                sx={{
                  fontWeight: 500,
                  fontSize: tableSizing.header.fontSize,
                  color: 'text.secondary',
                  textTransform: 'uppercase',
                  letterSpacing: '0.3px',
                  py: tableSizing.header.py,
                  px: tableSizing.header.px,
                }}
              >
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  <CalendarToday sx={{ fontSize: tableSizing.header.iconSize }} />
                  <span>Date</span>
                </Stack>
              </TableCell>
              <TableCell
                sx={{
                  fontWeight: 500,
                  fontSize: tableSizing.header.fontSize,
                  color: 'text.secondary',
                  textTransform: 'uppercase',
                  letterSpacing: '0.3px',
                  py: tableSizing.header.py,
                  px: tableSizing.header.px,
                }}
              >
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  <Person sx={{ fontSize: tableSizing.header.iconSize }} />
                  <span>Surveyors</span>
                </Stack>
              </TableCell>
              <TableCell
                sx={{
                  fontWeight: 500,
                  fontSize: tableSizing.header.fontSize,
                  color: 'text.secondary',
                  textTransform: 'uppercase',
                  letterSpacing: '0.3px',
                  py: tableSizing.header.py,
                  px: tableSizing.header.px,
                }}
              >
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  <Visibility sx={{ fontSize: tableSizing.header.iconSize }} />
                  <span>Sightings</span>
                </Stack>
              </TableCell>
              <TableCell
                sx={{
                  fontWeight: 500,
                  fontSize: tableSizing.header.fontSize,
                  color: 'text.secondary',
                  textTransform: 'uppercase',
                  letterSpacing: '0.3px',
                  py: tableSizing.header.py,
                  px: tableSizing.header.px,
                }}
              >
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  <LocationOn sx={{ fontSize: tableSizing.header.iconSize }} />
                  <span>Location</span>
                </Stack>
              </TableCell>
            </TableRow>
          </TableHead>

          {/* Table Body - Survey Rows */}
          <TableBody>
            {surveys.map((survey) => {
              const surveyorNames = survey.surveyor_ids.map(id => getSurveyorName(id));
              const isNewlyCreated = survey.id === createdSurveyId;

              return (
                <TableRow
                  key={survey.id}
                  ref={isNewlyCreated ? createdRowRef : null}
                  onClick={() => handleRowClick(survey.id)}
                  sx={{
                    bgcolor: isNewlyCreated ? 'rgba(219, 237, 219, 0.7)' : 'transparent',
                    transition: 'background-color 0.5s ease-out',
                    '&:hover': { bgcolor: isNewlyCreated ? 'rgba(219, 237, 219, 0.85)' : 'grey.50' },
                    cursor: 'pointer',
                    borderBottom: '1px solid',
                    borderColor: 'divider'
                  }}
                >
                  {/* Date Column */}
                  <TableCell sx={{ py: tableSizing.row.py, px: tableSizing.row.px, fontSize: tableSizing.row.fontSize }}>
                    {formatDate(survey.date)}
                  </TableCell>

                  {/* Surveyors Column - Avatar Stack */}
                  <TableCell sx={{ py: tableSizing.row.py, px: tableSizing.row.px }}>
                    <Box sx={{ display: 'flex', justifyContent: 'flex-start' }}>
                      <AvatarGroup
                        max={4}
                        sx={{
                          '& .MuiAvatar-root': {
                            width: tableSizing.avatar.size,
                            height: tableSizing.avatar.size,
                            fontSize: tableSizing.avatar.fontSize,
                            bgcolor: 'text.secondary',
                            border: '2px solid white',
                          }
                        }}
                      >
                        {surveyorNames.map((name, idx) => (
                          <Tooltip key={idx} title={name} arrow>
                            <Avatar alt={name}>
                              {getInitials(name)}
                            </Avatar>
                          </Tooltip>
                        ))}
                      </AvatarGroup>
                    </Box>
                  </TableCell>

                  {/* Sightings Column - Species breakdown with icons */}
                  <TableCell sx={{ py: tableSizing.row.py, px: tableSizing.row.px }}>
                    <Stack direction="row" spacing={1}>
                      {survey.species_breakdown.map((sighting, idx) => {
                        // Select icon based on species type
                        const Icon = sighting.type === 'butterfly'
                          ? ButterflyIcon
                          : sighting.type === 'bird'
                          ? BirdIcon
                          : MushroomIcon;

                        return (
                          <Chip
                            key={idx}
                            icon={<Icon sx={{ fontSize: '16px !important', ml: '6px !important' }} />}
                            label={sighting.count}
                            size="small"
                            sx={{
                              bgcolor: notionColors.gray.background,
                              color: notionColors.gray.text,
                              fontWeight: 500,
                              fontSize: tableSizing.chip.fontSize,
                              height: tableSizing.chip.height,
                              borderRadius: '4px',
                              '& .MuiChip-label': {
                                px: 1,
                                py: 0
                              }
                            }}
                          />
                        );
                      })}
                      {survey.species_breakdown.length === 0 && (
                        <Chip
                          label="0 sightings"
                          size="small"
                          sx={{
                            bgcolor: notionColors.gray.background,
                            color: notionColors.gray.text,
                            fontWeight: 500,
                            fontSize: tableSizing.chip.fontSize,
                            height: tableSizing.chip.height,
                            borderRadius: '4px',
                            '& .MuiChip-label': {
                              px: 1,
                              py: 0
                            }
                          }}
                        />
                      )}
                    </Stack>
                  </TableCell>

                  {/* Location Column */}
                  <TableCell sx={{ py: tableSizing.row.py, px: tableSizing.row.px, fontSize: tableSizing.row.fontSize, color: 'text.secondary' }}>
                    {getLocationName(survey.location_id)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Success Toast Notification */}
      <Snackbar
        open={showSuccessToast}
        autoHideDuration={4000}
        onClose={() => setShowSuccessToast(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setShowSuccessToast(false)}
          severity="success"
          variant="filled"
          sx={{ width: '100%' }}
        >
          Survey created successfully
        </Alert>
      </Snackbar>
    </Box>
  );
}
