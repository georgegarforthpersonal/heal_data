import { useState } from 'react';
import { Box, Typography, Paper, Stack, Breadcrumbs, Link, Chip, Button, Divider } from '@mui/material';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowBack, Edit, Delete, Save, Cancel, CalendarToday, Person, LocationOn, WbSunny, Thermostat, CheckCircle } from '@mui/icons-material';

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
  // Mock Data - Will come from API later
  // TODO: Replace with API call: const { data: survey } = useSurvey(id);
  // ============================================================================

  // Find survey from mock data (matching the data from SurveysPage)
  const mockSurveys = [
    {
      id: 1,
      date: 'Oct 25, 2025',
      surveyors: ['John Smith', 'Jane Doe'],
      location: 'Northern',
      sightings: [
        { type: 'butterflies', count: 45 },
        { type: 'birds', count: 23 },
        { type: 'fungi', count: 18 },
      ],
      // Additional survey details
      startTime: '09:00',
      endTime: '12:30',
      temperature: 22.5,
      sunPercentage: 80,
      conditionsMet: true,
      notes: 'Great weather for surveying. Spotted several rare species in the northern transect area.',
    },
    {
      id: 2,
      date: 'Oct 28, 2025',
      surveyors: ['Mike Johnson'],
      location: 'Eastern',
      sightings: [
        { type: 'butterflies', count: 12 },
      ],
      startTime: '10:00',
      endTime: '11:30',
      temperature: 18.0,
      sunPercentage: 60,
      conditionsMet: true,
      notes: '',
    },
  ];

  const survey = mockSurveys.find(s => s.id === Number(id));

  // Mock sightings data for this survey
  const mockSightings = Number(id) === 1 ? [
    { id: 1, species: 'Red Admiral', transect: 'Transect 1 - North Field', count: 12 },
    { id: 2, species: 'Peacock', transect: 'Transect 1 - North Field', count: 8 },
    { id: 3, species: 'Small Tortoiseshell', transect: 'Transect 2 - South Meadow', count: 15 },
    { id: 4, species: 'Comma', transect: 'Transect 2 - South Meadow', count: 6 },
    { id: 5, species: 'Painted Lady', transect: 'Transect 3 - East Woods', count: 4 },
    { id: 6, species: 'Small White', transect: 'Transect 1 - North Field', count: 22 },
    { id: 7, species: 'Large White', transect: 'Transect 2 - South Meadow', count: 11 },
    { id: 8, species: 'Green-veined White', transect: 'Transect 3 - East Woods', count: 9 },
    { id: 9, species: 'Orange Tip', transect: 'Transect 1 - North Field', count: 7 },
    { id: 10, species: 'Brimstone', transect: 'Transect 2 - South Meadow', count: 3 },
    { id: 11, species: 'Common Blue', transect: 'Transect 4 - West Garden', count: 18 },
    { id: 12, species: 'Holly Blue', transect: 'Transect 4 - West Garden', count: 5 },
    { id: 13, species: 'Meadow Brown', transect: 'Transect 1 - North Field', count: 28 },
    { id: 14, species: 'Gatekeeper', transect: 'Transect 2 - South Meadow', count: 14 },
    { id: 15, species: 'Ringlet', transect: 'Transect 3 - East Woods', count: 10 },
    { id: 16, species: 'Speckled Wood', transect: 'Transect 3 - East Woods', count: 19 },
    { id: 17, species: 'Marbled White', transect: 'Transect 1 - North Field', count: 13 },
    { id: 18, species: 'Small Skipper', transect: 'Transect 2 - South Meadow', count: 8 },
    { id: 19, species: 'Large Skipper', transect: 'Transect 4 - West Garden', count: 6 },
    { id: 20, species: 'Essex Skipper', transect: 'Transect 1 - North Field', count: 4 },
    { id: 21, species: 'Small Copper', transect: 'Transect 2 - South Meadow', count: 11 },
    { id: 22, species: 'Brown Argus', transect: 'Transect 3 - East Woods', count: 7 },
    { id: 23, species: 'Wall Brown', transect: 'Transect 4 - West Garden', count: 5 },
  ] : [
    { id: 1, species: 'Red Admiral', transect: 'Transect 1 - North Field', count: 5 },
    { id: 2, species: 'Peacock', transect: 'Transect 2 - South Meadow', count: 7 },
  ];

  // If survey not found, show error
  if (!survey) {
    return (
      <Box sx={{ p: 4 }}>
        <Typography variant="h4">Survey not found</Typography>
        <Button onClick={() => navigate('/surveys')} sx={{ mt: 2 }}>
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
          {survey.date} • {survey.surveyors.join(', ')}
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
              <Typography variant="body1">{survey.date}</Typography>
            </Box>

            <Box>
              <Typography variant="body2" color="text.secondary" fontWeight={500} sx={{ mb: 0.5 }}>
                Time
              </Typography>
              <Typography variant="body1">
                {survey.startTime} - {survey.endTime}
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
            <Typography variant="body1">{survey.surveyors.join(', ')}</Typography>
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
              <Typography variant="body1">{survey.location}</Typography>
            </Box>

            <Box>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                <Thermostat sx={{ fontSize: 18, color: 'text.secondary' }} />
                <Typography variant="body2" color="text.secondary" fontWeight={500}>
                  Temperature
                </Typography>
              </Stack>
              <Typography variant="body1">{survey.temperature}°C</Typography>
            </Box>

            <Box>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                <WbSunny sx={{ fontSize: 18, color: 'text.secondary' }} />
                <Typography variant="body2" color="text.secondary" fontWeight={500}>
                  Sun
                </Typography>
              </Stack>
              <Typography variant="body1">{survey.sunPercentage}%</Typography>
            </Box>

            <Box>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                <CheckCircle sx={{ fontSize: 18, color: 'text.secondary' }} />
                <Typography variant="body2" color="text.secondary" fontWeight={500}>
                  Conditions Met
                </Typography>
              </Stack>
              <Chip
                label={survey.conditionsMet ? 'Yes' : 'No'}
                size="small"
                sx={{
                  bgcolor: survey.conditionsMet ? 'success.lighter' : 'error.lighter',
                  color: survey.conditionsMet ? 'success.main' : 'error.main',
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
            Sightings ({mockSightings.length})
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
        {mockSightings.length > 0 ? (
          <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
            {/* Table Header */}
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: '2fr 2fr 1fr 100px',
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
                LOCATION
              </Typography>
              <Typography variant="body2" fontWeight={600} color="text.secondary">
                COUNT
              </Typography>
              <Typography variant="body2" fontWeight={600} color="text.secondary" textAlign="right">
                ACTIONS
              </Typography>
            </Box>

            {/* Table Rows */}
            {mockSightings.map((sighting, index) => (
              <Box
                key={sighting.id}
                sx={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 2fr 1fr 100px',
                  gap: 2,
                  p: 1.5,
                  borderBottom: index < mockSightings.length - 1 ? '1px solid' : 'none',
                  borderColor: 'divider',
                  '&:hover': { bgcolor: 'grey.50' }
                }}
              >
                <Typography variant="body2">{sighting.species}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {sighting.transect}
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
