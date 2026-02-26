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
import { Lock, Save, Cancel, CloudUpload, AudioFile, Delete } from '@mui/icons-material';
import dayjs, { Dayjs } from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  surveysAPI,
  surveyorsAPI,
  locationsAPI,
  speciesAPI,
  surveyTypesAPI,
  audioAPI,
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
  const { isAuthenticated, isLoading: authLoading, requireAuth } = useAuth();

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
  // Form State - Audio Files (for audio survey type)
  // ============================================================================

  const [pendingAudioFiles, setPendingAudioFiles] = useState<File[]>([]);

  // Draft survey state - created when audio files are added to allow immediate processing
  const [draftSurveyId, setDraftSurveyId] = useState<number | null>(null);
  const [isCreatingDraft, setIsCreatingDraft] = useState(false);
  const [isUploadingAudio, setIsUploadingAudio] = useState(false);

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

    // If location at sighting level, check that each sighting has a location
    const validSightings = draftSightings.filter(
      (s) => s.species_id !== null && s.count > 0
    );
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
  // Audio File Handlers
  // ============================================================================

  /**
   * Create a draft survey if one doesn't exist yet.
   * This allows audio files to be uploaded immediately for processing.
   */
  const ensureDraftSurvey = async (): Promise<number> => {
    if (draftSurveyId) return draftSurveyId;

    setIsCreatingDraft(true);
    try {
      // Create minimal draft survey with current form state
      const draftData: Partial<Survey> & { survey_type_id?: number } = {
        date: date?.format('YYYY-MM-DD') || new Date().toISOString().split('T')[0],
        surveyor_ids: selectedSurveyors.map((s) => s.id),
        survey_type_id: selectedSurveyType?.id,
      };

      const draft = await surveysAPI.create(draftData, true);
      setDraftSurveyId(draft.id);
      return draft.id;
    } finally {
      setIsCreatingDraft(false);
    }
  };

  const handleAudioFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    // Filter to only WAV files
    const validFiles = Array.from(files).filter(
      (f) => f.name.endsWith('.wav') || f.name.endsWith('.WAV')
    );

    if (validFiles.length === 0) return;

    // Reset input so the same file can be selected again
    event.target.value = '';

    // Add files to pending list immediately for UI feedback
    setPendingAudioFiles((prev) => [...prev, ...validFiles]);

    setIsUploadingAudio(true);
    try {
      // Ensure we have a draft survey, then upload files immediately
      const surveyId = await ensureDraftSurvey();
      await audioAPI.uploadFiles(surveyId, validFiles);
    } catch (err) {
      // Remove the files from pending if upload failed
      setPendingAudioFiles((prev) =>
        prev.filter((f) => !validFiles.some((vf) => vf.name === f.name && vf.size === f.size))
      );
      setError(err instanceof Error ? err.message : 'Failed to upload audio files');
      console.error('Error uploading audio files:', err);
    } finally {
      setIsUploadingAudio(false);
    }
  };

  const handleRemoveAudioFile = (index: number) => {
    // Note: We don't delete from server here - orphaned files will be cleaned up
    // when the draft survey is deleted (if user cancels) or kept (if user saves)
    setPendingAudioFiles((prev) => prev.filter((_, i) => i !== index));
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
      // Prepare survey data
      const surveyData: Partial<Survey> & { survey_type_id?: number; is_draft?: boolean } = {
        date: date!.format('YYYY-MM-DD'),
        surveyor_ids: selectedSurveyors.map((s) => s.id),
        notes: notes.trim() || null,
        survey_type_id: selectedSurveyType?.id,
      };

      // Only include location_id if NOT at sighting level
      if (!selectedSurveyType?.location_at_sighting_level) {
        surveyData.location_id = locationId ?? undefined;
      }

      let finalSurvey: Survey;

      if (draftSurveyId) {
        // Draft exists - update it and finalize (audio already uploaded)
        surveyData.is_draft = false;
        finalSurvey = await surveysAPI.update(draftSurveyId, surveyData);
      } else {
        // No draft - create new survey
        finalSurvey = await surveysAPI.create(surveyData);
      }

      // Add sightings (with individual locations if provided)
      const validSightings = draftSightings.filter(
        (s) => s.species_id !== null && s.count > 0
      );

      await Promise.all(
        validSightings.map((sighting) =>
          surveysAPI.addSighting(finalSurvey.id, {
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

      // Success - navigate to survey detail page (shows audio processing status)
      // or surveys list if not an audio survey
      if (allowAudioUpload && pendingAudioFiles.length > 0) {
        navigate(`/surveys/${finalSurvey.id}`);
      } else {
        navigate(`/surveys?created=${finalSurvey.id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create survey');
      console.error('Error creating survey:', err);
      setSaving(false);
    }
  };

  // ============================================================================
  // Event Handlers
  // ============================================================================

  const handleCancel = async () => {
    // Clean up draft survey if one was created
    if (draftSurveyId) {
      try {
        await surveysAPI.delete(draftSurveyId);
      } catch (err) {
        // Ignore errors - draft cleanup is best effort
        console.error('Failed to delete draft survey:', err);
      }
    }
    navigate('/surveys');
  };

  const handleSurveyTypeChange = async (surveyType: SurveyType | null) => {
    // If switching away from audio survey type and we have a draft, delete it
    if (draftSurveyId && !surveyType?.allow_audio_upload) {
      try {
        await surveysAPI.delete(draftSurveyId);
      } catch (err) {
        console.error('Failed to delete draft survey:', err);
      }
      setDraftSurveyId(null);
    }

    setSelectedSurveyType(surveyType);
    // Clear location when survey type changes
    setLocationId(null);
    // Clear pending audio files when switching to a survey type that doesn't allow audio
    if (!surveyType?.allow_audio_upload) {
      setPendingAudioFiles([]);
    }
    // Clear validation error
    if (validationErrors.surveyType) {
      setValidationErrors({ ...validationErrors, surveyType: undefined });
    }
  };

  // ============================================================================
  // Loading State
  // ============================================================================

  // Auth gate
  if (authLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!isAuthenticated) {
    return (
      <Box sx={{ p: { xs: 2, sm: 3, md: 4 }, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}>
        <Lock sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
        <Typography variant="h6" sx={{ mb: 1 }}>
          Admin Access Required
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3, textAlign: 'center' }}>
          You need to enter the admin password to create a new survey.
        </Typography>
        <Button
          variant="contained"
          onClick={() => requireAuth(() => {})}
          sx={{ bgcolor: '#8B8AC7', '&:hover': { bgcolor: '#7A79B6' } }}
        >
          Enter Password
        </Button>
      </Box>
    );
  }

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
  const allowAudioUpload = selectedSurveyType?.allow_audio_upload ?? false;

  // Determine if save button should be disabled
  const saveDisabled =
    saving ||
    isUploadingAudio ||
    isCreatingDraft ||
    !selectedSurveyType ||
    !date ||
    selectedSurveyors.length === 0;

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

      {/* Audio Upload Section - Only for audio surveys */}
      {allowAudioUpload && (
        <Paper
          sx={{
            p: 3,
            mb: 3,
            boxShadow: 'none',
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                Audio Files ({pendingAudioFiles.length})
              </Typography>
              {(isCreatingDraft || isUploadingAudio) && (
                <CircularProgress size={16} />
              )}
            </Stack>
            <Button
              component="label"
              variant="contained"
              startIcon={<CloudUpload />}
              disabled={isUploadingAudio || isCreatingDraft}
              sx={{
                textTransform: 'none',
                fontWeight: 600,
                boxShadow: 'none',
                '&:hover': { boxShadow: 'none' },
              }}
            >
              {isUploadingAudio ? 'Uploading...' : 'Add Files'}
              <input
                type="file"
                hidden
                multiple
                accept=".wav,.WAV"
                onChange={handleAudioFileSelect}
              />
            </Button>
          </Stack>

          {pendingAudioFiles.length > 0 ? (
            <>
              <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
                {pendingAudioFiles.map((file, index) => (
                  <Box
                    key={`${file.name}-${index}`}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      p: 1.5,
                      borderBottom: '1px solid',
                      borderColor: 'divider',
                      '&:last-child': { borderBottom: 'none' },
                      '&:hover': { bgcolor: 'grey.50' },
                    }}
                  >
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <AudioFile sx={{ fontSize: 20, color: 'text.secondary' }} />
                      <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>
                        {file.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                        ({(file.size / 1024 / 1024).toFixed(1)} MB)
                      </Typography>
                    </Stack>
                    <Button
                      size="small"
                      color="error"
                      onClick={() => handleRemoveAudioFile(index)}
                      sx={{ minWidth: 'auto', p: 0.5 }}
                    >
                      <Delete fontSize="small" />
                    </Button>
                  </Box>
                ))}
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5, fontStyle: 'italic' }}>
                Files are uploaded immediately and processing begins in the background.
              </Typography>
            </>
          ) : (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <AudioFile sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
              <Typography color="text.secondary">
                Add WAV files to upload with this survey.
              </Typography>
            </Box>
          )}
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
            surveyLocationId={locationId}
          />
        </Paper>
      )}
    </Box>
  );
}
