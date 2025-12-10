import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Stack,
  Button,
  Alert,
  CircularProgress,
} from '@mui/material';
import dayjs, { Dayjs } from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { Save, Cancel } from '@mui/icons-material';
import { surveysAPI, surveyorsAPI, locationsAPI, speciesAPI } from '../services/api';
import type { Survey, Location, Surveyor, Species } from '../services/api';
import { SurveyFormFields } from '../components/surveys/SurveyFormFields';
import { SightingsEditor } from '../components/surveys/SightingsEditor';
import type { DraftSighting } from '../components/surveys/SightingsEditor';
import { PageHeader } from '../components/layout/PageHeader';

/**
 * NewSurveyPage - Full-page form for creating surveys with inline sightings
 *
 * Features:
 * - Complete survey creation in one place
 * - Inline sightings editor (add multiple sightings before saving)
 * - Single transaction saves survey + all sightings
 * - No modal → page transition required
 *
 * Following DEVELOPMENT.md conventions:
 * - Built inline first
 * - Uses MUI components with theme integration
 * - Simple state management
 */
export function NewSurveyPage() {
  const navigate = useNavigate();

  // ============================================================================
  // Form State - Survey Fields
  // ============================================================================

  const [date, setDate] = useState<Dayjs | null>(dayjs());
  const [locationId, setLocationId] = useState<number | null>(null);
  const [selectedSurveyors, setSelectedSurveyors] = useState<Surveyor[]>([]);
  const [notes, setNotes] = useState<string>('');

  // ============================================================================
  // Form State - Sightings
  // ============================================================================

  // Start with one empty row for desktop inline editing
  const [draftSightings, setDraftSightings] = useState<DraftSighting[]>([
    {
      tempId: `temp-${Date.now()}`,
      species_id: null,
      count: 1,
    },
  ]);

  // ============================================================================
  // Data State
  // ============================================================================

  const [locations, setLocations] = useState<Location[]>([]);
  const [surveyors, setSurveyors] = useState<Surveyor[]>([]);
  const [species, setSpecies] = useState<Species[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ============================================================================
  // Validation State
  // ============================================================================

  const [validationErrors, setValidationErrors] = useState<{
    date?: string;
    location?: string;
    surveyors?: string;
    sightings?: string;
  }>({});

  // ============================================================================
  // Data Fetching
  // ============================================================================

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch all necessary data in parallel
        const [locationsData, surveyorsData, speciesData] = await Promise.all([
          locationsAPI.getAll(),
          surveyorsAPI.getAll(),
          speciesAPI.getAll(),
        ]);

        setLocations(locationsData);
        setSurveyors(surveyorsData);
        setSpecies(speciesData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load form data');
        console.error('Error fetching data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // ============================================================================
  // Validation
  // ============================================================================

  const validate = (): boolean => {
    const errors: typeof validationErrors = {};

    if (!date) {
      errors.date = 'Date is required';
    }

    if (!locationId) {
      errors.location = 'Location is required';
    }

    if (selectedSurveyors.length === 0) {
      errors.surveyors = 'At least one surveyor is required';
    }

    // Check for at least one valid sighting
    const validSightings = draftSightings.filter(
      (s) => s.species_id !== null && s.count > 0
    );
    if (validSightings.length === 0) {
      errors.sightings = 'At least one sighting is required';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // ============================================================================
  // Sightings Change Handler
  // ============================================================================

  const handleSightingsChange = (newSightings: DraftSighting[]) => {
    setDraftSightings(newSightings);

    // Clear sightings validation error when user changes sightings
    if (validationErrors.sightings) {
      setValidationErrors({ ...validationErrors, sightings: undefined });
    }
  };

  // ============================================================================
  // Form Submission
  // ============================================================================

  const handleSave = async () => {
    // Validate survey fields
    if (!validate()) {
      setError('Please fill in all required fields');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // Step 1: Create survey
      const surveyData: Partial<Survey> = {
        date: date!.format('YYYY-MM-DD'),
        location_id: locationId!,
        surveyor_ids: selectedSurveyors.map((s) => s.id),
        type: 'butterfly', // Default type
        notes: notes.trim() || null,
      };

      const newSurvey = await surveysAPI.create(surveyData);

      // Step 2: Add sightings
      const validSightings = draftSightings.filter(
        (s) => s.species_id !== null && s.count > 0
      );

      await Promise.all(
        validSightings.map((sighting) =>
          surveysAPI.addSighting(newSurvey.id, {
            species_id: sighting.species_id!,
            count: sighting.count,
            latitude: sighting.latitude,
            longitude: sighting.longitude,
          })
        )
      );

      // Success - navigate back to surveys list with created parameter
      navigate(`/surveys?created=${newSurvey.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create survey');
      console.error('Error creating survey:', err);
      setSaving(false);
    }
  };

  // ============================================================================
  // Event Handlers
  // ============================================================================

  const handleCancel = () => {
    navigate('/surveys');
  };

  // ============================================================================
  // Loading State
  // ============================================================================

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <Box sx={{ p: 4 }}>
      {/* Page Header */}
      <PageHeader
        backButton={{ href: '/surveys' }}
        actions={
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              startIcon={<Cancel />}
              onClick={handleCancel}
              disabled={saving}
              sx={{
                textTransform: 'none',
                fontWeight: 600,
                boxShadow: 'none',
              }}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              startIcon={saving ? undefined : <Save />}
              onClick={handleSave}
              disabled={
                saving ||
                !date ||
                !locationId ||
                selectedSurveyors.length === 0 ||
                draftSightings.filter((s) => s.species_id !== null && s.count > 0).length === 0
              }
              sx={{
                textTransform: 'none',
                fontWeight: 600,
                boxShadow: 'none',
                '&:hover': { boxShadow: 'none' },
                minWidth: 140,
              }}
            >
              {saving ? (
                <>
                  <CircularProgress size={20} sx={{ mr: 1 }} />
                  Saving...
                </>
              ) : (
                'Save Survey'
              )}
            </Button>
          </Stack>
        }
      />
        {/* Error Alert */}
        {error && (
          <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {/* Survey Details Card */}
        <Paper
          sx={{
            p: 3,
            mb: 3,
            boxShadow: 'none',
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
            Survey Details
          </Typography>

          <SurveyFormFields
            date={date}
            locationId={locationId}
            selectedSurveyors={selectedSurveyors}
            notes={notes}
            locations={locations}
            surveyors={surveyors}
            onDateChange={setDate}
            onLocationChange={setLocationId}
            onSurveyorsChange={setSelectedSurveyors}
            onNotesChange={setNotes}
            validationErrors={validationErrors}
          />
        </Paper>

        {/* Sightings Card */}
        <Paper
          sx={{
            p: 3,
            boxShadow: 'none',
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          <SightingsEditor
            sightings={draftSightings}
            species={species}
            onSightingsChange={handleSightingsChange}
            validationError={validationErrors.sightings}
          />
        </Paper>
    </Box>
  );
}
