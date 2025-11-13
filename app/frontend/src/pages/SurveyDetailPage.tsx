import { useState, useEffect } from 'react';
import { Box, Typography, Paper, Stack, Breadcrumbs, Link, Chip, Button, Divider, CircularProgress, Alert } from '@mui/material';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowBack, Edit, Delete, Save, Cancel, CalendarToday, Person, LocationOn, WbSunny, Thermostat, CheckCircle } from '@mui/icons-material';
import { surveysAPI, surveyorsAPI, locationsAPI, speciesAPI } from '../services/api';
import type { SurveyDetail, Sighting, Surveyor, Location, Species } from '../services/api';

/**
 * SurveyDetailPage displays detailed information about a single survey
 * - Breadcrumb navigation back to surveys list
 * - Survey metadata (date, surveyors, weather, etc.)
 * - Sightings table (view and edit)
 * - View/Edit mode toggle
 *
 * Following DEVELOPMENT.md conventions:
 * - Built inline first (no premature component extraction)
 * - Uses MUI components with theme integration
 * - Mock data ready to be replaced with API calls
 */
export function SurveyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Check if we should start in edit mode (from URL param)
  const startInEditMode = searchParams.get('edit') === 'true';
  const [isEditMode, setIsEditMode] = useState(startInEditMode);

  // ============================================================================
  // State Management
  // ============================================================================

  const [survey, setSurvey] = useState<SurveyDetail | null>(null);
  const [sightings, setSightings] = useState<Sighting[]>([]);
  const [surveyors, setSurveyors] = useState<Surveyor[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [species, setSpecies] = useState<Species[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ============================================================================
  // Data Fetching
  // ============================================================================

  useEffect(() => {
    const fetchData = async () => {
      if (!id) {
        setError('No survey ID provided');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Fetch all data in parallel
        const [surveyData, sightingsData, surveyorsData, locationsData, speciesData] = await Promise.all([
          surveysAPI.getById(Number(id)),
          surveysAPI.getSightings(Number(id)),
          surveyorsAPI.getAll(),
          locationsAPI.getAll(),
          speciesAPI.getAll(),
        ]);

        setSurvey(surveyData);
        setSightings(sightingsData);
        setSurveyors(surveyorsData);
        setLocations(locationsData);
        setSpecies(speciesData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load survey details');
        console.error('Error fetching survey:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

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
   * Get species name from ID
   */
  const getSpeciesName = (id: number): string => {
    const speciesItem = species.find(s => s.id === id);
    return speciesItem?.name || 'Unknown';
  };

  /**
   * Format date from YYYY-MM-DD to readable format
   */
  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  /**
   * Format time from HH:MM:SS to HH:MM
   */
  const formatTime = (timeStr: string | null): string => {
    if (!timeStr) return 'N/A';
    return timeStr.substring(0, 5); // Extract HH:MM from HH:MM:SS
  };

  // ============================================================================
  // Loading and Error States
  // ============================================================================

  // Show loading state
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  // Show error state or survey not found
  if (error || !survey) {
    return (
      <Box sx={{ p: 4 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error || 'Survey not found'}
        </Alert>
        <Button variant="contained" onClick={() => navigate('/surveys')}>
          Back to Surveys
        </Button>
      </Box>
    );
  }

  // ============================================================================
  // Event Handlers
  // ============================================================================

  const handleBack = () => {
    navigate('/surveys');
  };

  const handleEditClick = () => {
    setIsEditMode(true);
  };

  const handleSave = () => {
    // TODO: Save changes to API
    console.log('Saving changes...');
    setIsEditMode(false);
  };

  const handleCancel = () => {
    // TODO: Revert changes
    console.log('Canceling changes...');
    setIsEditMode(false);
  };

  const handleDelete = () => {
    // TODO: Show confirmation dialog, then delete via API
    console.log('Delete survey:', id);
    // After deletion, navigate back to surveys list
    // navigate('/surveys');
  };

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <Box sx={{ p: 4 }}>
      {/* Breadcrumb Navigation */}
      <Breadcrumbs sx={{ mb: 3 }}>
        <Link
          component="button"
          onClick={handleBack}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            textDecoration: 'none',
            color: 'text.secondary',
            cursor: 'pointer',
            '&:hover': { color: 'primary.main' }
          }}
        >
          <ArrowBack sx={{ fontSize: 18 }} />
          Surveys
        </Link>
        <Typography color="text.primary">
          {formatDate(survey.date)} • {getLocationName(survey.location_id)}
        </Typography>
      </Breadcrumbs>

      {/* Page Header */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 3 }}>
        <Typography
          variant="h1"
          sx={{
            fontSize: '2.5rem',
            fontWeight: 700,
            color: 'text.primary'
          }}
        >
          Survey Details
        </Typography>

        {/* TODO: Add RBAC permission checks - only show these buttons to admin users */}
        {/* When implementing: const { hasPermission } = useAuth(); */}
        {/* Then wrap buttons with: {hasPermission('edit_survey') && <Button.../>} */}

        {isEditMode ? (
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              startIcon={<Cancel />}
              onClick={handleCancel}
              sx={{
                textTransform: 'none',
                fontWeight: 600,
                boxShadow: 'none'
              }}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              startIcon={<Save />}
              onClick={handleSave}
              sx={{
                textTransform: 'none',
                fontWeight: 600,
                boxShadow: 'none',
                '&:hover': { boxShadow: 'none' }
              }}
            >
              Save Changes
            </Button>
          </Stack>
        ) : (
          <Stack direction="row" spacing={1}>
            <Button
              variant="contained"
              startIcon={<Edit />}
              onClick={handleEditClick}
              sx={{
                textTransform: 'none',
                fontWeight: 600,
                boxShadow: 'none',
                '&:hover': { boxShadow: 'none' }
              }}
            >
              Edit Survey
            </Button>
            <Button
              variant="outlined"
              color="error"
              startIcon={<Delete />}
              onClick={handleDelete}
              sx={{
                textTransform: 'none',
                fontWeight: 600,
                boxShadow: 'none'
              }}
            >
              Delete
            </Button>
          </Stack>
        )}
      </Stack>

      {/* Survey Metadata Card */}
      <Paper
        sx={{
          p: 3,
          mb: 3,
          boxShadow: 'none',
          border: '1px solid',
          borderColor: 'divider'
        }}
      >
        <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
          Survey Information
        </Typography>

        <Stack spacing={2}>
          {/* Date and Time */}
          <Stack direction="row" spacing={4} flexWrap="wrap">
            <Box>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                <CalendarToday sx={{ fontSize: 18, color: 'text.secondary' }} />
                <Typography variant="body2" color="text.secondary" fontWeight={500}>
                  Date
                </Typography>
              </Stack>
              <Typography variant="body1">{formatDate(survey.date)}</Typography>
            </Box>

            <Box>
              <Typography variant="body2" color="text.secondary" fontWeight={500} sx={{ mb: 0.5 }}>
                Time
              </Typography>
              <Typography variant="body1">
                {formatTime(survey.start_time)} - {formatTime(survey.end_time)}
              </Typography>
            </Box>
          </Stack>

          <Divider />

          {/* Surveyors */}
          <Box>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
              <Person sx={{ fontSize: 18, color: 'text.secondary' }} />
              <Typography variant="body2" color="text.secondary" fontWeight={500}>
                Surveyors
              </Typography>
            </Stack>
            <Typography variant="body1">{survey.surveyor_ids.map(getSurveyorName).join(', ')}</Typography>
          </Box>

          <Divider />

          {/* Location and Weather */}
          <Stack direction="row" spacing={4} flexWrap="wrap">
            <Box>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                <LocationOn sx={{ fontSize: 18, color: 'text.secondary' }} />
                <Typography variant="body2" color="text.secondary" fontWeight={500}>
                  Location
                </Typography>
              </Stack>
              <Typography variant="body1">{getLocationName(survey.location_id)}</Typography>
            </Box>

            <Box>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                <Thermostat sx={{ fontSize: 18, color: 'text.secondary' }} />
                <Typography variant="body2" color="text.secondary" fontWeight={500}>
                  Temperature
                </Typography>
              </Stack>
              <Typography variant="body1">
                {survey.temperature_celsius ? `${survey.temperature_celsius}°C` : 'N/A'}
              </Typography>
            </Box>

            <Box>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                <WbSunny sx={{ fontSize: 18, color: 'text.secondary' }} />
                <Typography variant="body2" color="text.secondary" fontWeight={500}>
                  Sun
                </Typography>
              </Stack>
              <Typography variant="body1">
                {survey.sun_percentage !== null ? `${survey.sun_percentage}%` : 'N/A'}
              </Typography>
            </Box>

            <Box>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                <CheckCircle sx={{ fontSize: 18, color: 'text.secondary' }} />
                <Typography variant="body2" color="text.secondary" fontWeight={500}>
                  Conditions Met
                </Typography>
              </Stack>
              <Chip
                label={survey.conditions_met ? 'Yes' : 'No'}
                size="small"
                sx={{
                  bgcolor: survey.conditions_met ? 'success.lighter' : 'error.lighter',
                  color: survey.conditions_met ? 'success.main' : 'error.main',
                  fontWeight: 500,
                  height: 24
                }}
              />
            </Box>
          </Stack>

          {/* Notes */}
          {survey.notes && (
            <>
              <Divider />
              <Box>
                <Typography variant="body2" color="text.secondary" fontWeight={500} sx={{ mb: 0.5 }}>
                  Notes
                </Typography>
                <Typography variant="body1">{survey.notes}</Typography>
              </Box>
            </>
          )}
        </Stack>
      </Paper>

      {/* Sightings Section */}
      <Paper
        sx={{
          p: 3,
          boxShadow: 'none',
          border: '1px solid',
          borderColor: 'divider'
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Sightings ({sightings.length})
          </Typography>
          <Button
            variant="outlined"
            size="small"
            sx={{
              textTransform: 'none',
              fontWeight: 600,
              boxShadow: 'none'
            }}
          >
            + Add Sighting
          </Button>
        </Stack>

        {/* Sightings Table */}
        {sightings.length > 0 ? (
          <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
            {/* Table Header */}
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: '3fr 1fr 100px',
                gap: 2,
                p: 1.5,
                bgcolor: 'grey.50',
                borderBottom: '1px solid',
                borderColor: 'divider'
              }}
            >
              <Typography variant="body2" fontWeight={600} color="text.secondary">
                SPECIES
              </Typography>
              <Typography variant="body2" fontWeight={600} color="text.secondary">
                COUNT
              </Typography>
              <Typography variant="body2" fontWeight={600} color="text.secondary" textAlign="right">
                ACTIONS
              </Typography>
            </Box>

            {/* Table Rows */}
            {sightings.map((sighting, index) => (
              <Box
                key={sighting.id}
                sx={{
                  display: 'grid',
                  gridTemplateColumns: '3fr 1fr 100px',
                  gap: 2,
                  p: 1.5,
                  borderBottom: index < sightings.length - 1 ? '1px solid' : 'none',
                  borderColor: 'divider',
                  '&:hover': { bgcolor: 'grey.50' }
                }}
              >
                <Typography variant="body2">
                  {sighting.species_name || getSpeciesName(sighting.species_id)}
                </Typography>
                <Typography variant="body2" fontWeight={600}>
                  {sighting.count}
                </Typography>
                <Stack direction="row" spacing={1} justifyContent="flex-end">
                  <Button size="small" sx={{ minWidth: 0, p: 0.5 }}>
                    <Edit sx={{ fontSize: 16 }} />
                  </Button>
                  <Button size="small" color="error" sx={{ minWidth: 0, p: 0.5 }}>
                    <Delete sx={{ fontSize: 16 }} />
                  </Button>
                </Stack>
              </Box>
            ))}
          </Box>
        ) : (
          <Typography color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
            No sightings recorded yet. Click "Add Sighting" to get started.
          </Typography>
        )}
      </Paper>
    </Box>
  );
}
