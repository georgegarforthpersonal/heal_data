import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Stack,
  Button,
  Alert,
  CircularProgress,
  Autocomplete,
  TextField,
} from '@mui/material';
import dayjs, { Dayjs } from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { Save, Cancel } from '@mui/icons-material';
import {
  surveysAPI,
  surveyorsAPI,
  locationsAPI,
  speciesAPI,
  surveyTypesAPI,
} from '../services/api';
import type {
  Survey,
  Location,
  Surveyor,
  Species,
  BreedingStatusCode,
  LocationWithBoundary,
  SurveyType,
} from '../services/api';
import { SurveyFormFields } from '../components/surveys/SurveyFormFields';
import { SightingsEditor } from '../components/surveys/SightingsEditor';
import type { DraftSighting } from '../components/surveys/SightingsEditor';
import { PageHeader } from '../components/layout/PageHeader';

/**
 * NewSurveyPage - Full-page form for creating surveys with inline sightings
 *
 * Features:
 * - Survey type selection filters available locations and species
 * - Complete survey creation in one place
 * - Inline sightings editor (add multiple sightings before saving)
 * - Single transaction saves survey + all sightings
 * - Supports location at sighting level when configured
 */
export function NewSurveyPage() {
  const navigate = useNavigate();

  // ============================================================================
  // Form State - Survey Type
  // ============================================================================

  const [surveyTypes, setSurveyTypes] = useState<SurveyType[]>([]);
  const [selectedSurveyType, setSelectedSurveyType] = useState<SurveyType | null>(null);
  const [surveyTypesLoading, setSurveyTypesLoading] = useState(true);

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
  const [breedingCodes, setBreedingCodes] = useState<BreedingStatusCode[]>([]);
  const [locationsWithBoundaries, setLocationsWithBoundaries] = useState<LocationWithBoundary[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ============================================================================
  // Validation State
  // ============================================================================

  const [validationErrors, setValidationErrors] = useState<{
    surveyType?: string;
    date?: string;
    location?: string;
    surveyors?: string;
    sightings?: string;
  }>({});

  // ============================================================================
  // Data Fetching - Initial Load
  // ============================================================================

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        setLoading(true);
        setSurveyTypesLoading(true);
        setError(null);

        // Fetch survey types and other base data in parallel
        const [surveyTypesData, surveyorsData, breedingCodesData, boundariesData] = await Promise.all([
          surveyTypesAPI.getAll(),
          surveyorsAPI.getAll(),
          surveysAPI.getBreedingCodes(),
          locationsAPI.getAllWithBoundaries(),
        ]);

        setSurveyTypes(surveyTypesData);
        setSurveyors(surveyorsData);
        setBreedingCodes(breedingCodesData);
        setLocationsWithBoundaries(boundariesData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load form data');
        console.error('Error fetching data:', err);
      } finally {
        setLoading(false);
        setSurveyTypesLoading(false);
      }
    };

    fetchInitialData();
  }, []);

  // ============================================================================
  // Data Fetching - When Survey Type Changes
  // ============================================================================

  useEffect(() => {
    if (!selectedSurveyType) {
      setLocations([]);
      setSpecies([]);
      return;
    }

    const fetchFilteredData = async () => {
      try {
        const [locationsData, speciesData] = await Promise.all([
          locationsAPI.getBySurveyType(selectedSurveyType.id),
          speciesAPI.getBySurveyType(selectedSurveyType.id),
        ]);

        setLocations(locationsData);
        setSpecies(speciesData);

        // Clear location if it's no longer in the available list
        if (locationId && !locationsData.some((l) => l.id === locationId)) {
          setLocationId(null);
        }

        // Clear sightings with species no longer available
        const validSpeciesIds = new Set(speciesData.map((s) => s.id));
        setDraftSightings((prev) =>
          prev.map((s) => ({
            ...s,
            species_id: s.species_id && validSpeciesIds.has(s.species_id) ? s.species_id : null,
          }))
        );
      } catch (err) {
        console.error('Error fetching filtered data:', err);
      }
    };

    fetchFilteredData();
  }, [selectedSurveyType]);

  // ============================================================================
  // Validation
  // ============================================================================

  const validate = (): boolean => {
    const errors: typeof validationErrors = {};

    if (!selectedSurveyType) {
      errors.surveyType = 'Survey type is required';
    }

    if (!date) {
      errors.date = 'Date is required';
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

    // If location at sighting level, check that each sighting has a location
    if (selectedSurveyType?.location_at_sighting_level) {
      const sightingsWithoutLocation = validSightings.filter((s) => !s.location_id);
      if (sightingsWithoutLocation.length > 0) {
        errors.sightings = 'Each sighting must have a location selected';
      }
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
      const surveyData: Partial<Survey> & { survey_type_id?: number } = {
        date: date!.format('YYYY-MM-DD'),
        surveyor_ids: selectedSurveyors.map((s) => s.id),
        notes: notes.trim() || null,
        survey_type_id: selectedSurveyType?.id,
      };

      // Only include location_id if NOT at sighting level
      if (!selectedSurveyType?.location_at_sighting_level) {
        surveyData.location_id = locationId;
      }

      const newSurvey = await surveysAPI.create(surveyData);

      // Step 2: Add sightings (with individual locations if provided)
      const validSightings = draftSightings.filter(
        (s) => s.species_id !== null && s.count > 0
      );

      await Promise.all(
        validSightings.map((sighting) =>
          surveysAPI.addSighting(newSurvey.id, {
            species_id: sighting.species_id!,
            count: sighting.count,
            location_id: selectedSurveyType?.location_at_sighting_level ? sighting.location_id : undefined,
            notes: sighting.notes,
            // Include individual locations with count and breeding status codes
            individuals: sighting.individuals?.map((ind) => ({
              latitude: ind.latitude,
              longitude: ind.longitude,
              count: ind.count,
              breeding_status_code: ind.breeding_status_code,
              notes: ind.notes,
            })),
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

  const handleSurveyTypeChange = (surveyType: SurveyType | null) => {
    setSelectedSurveyType(surveyType);
    // Clear location when survey type changes
    setLocationId(null);
    // Clear validation error
    if (validationErrors.surveyType) {
      setValidationErrors({ ...validationErrors, surveyType: undefined });
    }
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
  // Computed Values
  // ============================================================================

  const locationAtSightingLevel = selectedSurveyType?.location_at_sighting_level ?? false;
  const allowGeolocation = selectedSurveyType?.allow_geolocation ?? true;
  const allowSightingNotes = selectedSurveyType?.allow_sighting_notes ?? true;

  // Determine if save button should be disabled
  const hasValidSightings = draftSightings.filter((s) => s.species_id !== null && s.count > 0).length > 0;
  const saveDisabled =
    saving ||
    !selectedSurveyType ||
    !date ||
    selectedSurveyors.length === 0 ||
    !hasValidSightings;

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
              disabled={saveDisabled}
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

      {/* Survey Type Selection Card */}
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
          Survey Type
        </Typography>
        <Autocomplete
          options={surveyTypes}
          getOptionLabel={(option) => option.name}
          value={selectedSurveyType}
          onChange={(_, newValue) => handleSurveyTypeChange(newValue)}
          loading={surveyTypesLoading}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Survey Type"
              required
              error={!!validationErrors.surveyType}
              helperText={validationErrors.surveyType}
            />
          )}
          isOptionEqualToValue={(option, value) => option.id === value.id}
        />
      </Paper>

      {/* Survey Details Card - Only show when survey type is selected */}
      {selectedSurveyType && (
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
            hideLocation={locationAtSightingLevel}
          />
        </Paper>
      )}

      {/* Sightings Card - Only show when survey type is selected */}
      {selectedSurveyType && (
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
            breedingCodes={breedingCodes}
            onSightingsChange={handleSightingsChange}
            validationError={validationErrors.sightings}
            locationsWithBoundaries={locationsWithBoundaries}
            locationAtSightingLevel={locationAtSightingLevel}
            locations={locations}
            allowGeolocation={allowGeolocation}
            allowSightingNotes={allowSightingNotes}
          />
        </Paper>
      )}
    </Box>
  );
}
