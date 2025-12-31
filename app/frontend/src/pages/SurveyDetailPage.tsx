import { useState, useEffect } from 'react';
import { Box, Typography, Paper, Stack, Button, Divider, CircularProgress, Alert, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Tooltip } from '@mui/material';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Edit, Delete, Save, Cancel, CalendarToday, Person, LocationOn } from '@mui/icons-material';
import dayjs, { Dayjs } from 'dayjs';
import { surveysAPI, surveyorsAPI, locationsAPI, speciesAPI } from '../services/api';
import type { SurveyDetail, Sighting, Surveyor, Location, Species, Survey, BreedingStatusCode, LocationWithBoundary } from '../services/api';
import { SurveyFormFields } from '../components/surveys/SurveyFormFields';
import { SightingsEditor } from '../components/surveys/SightingsEditor';
import type { DraftSighting } from '../components/surveys/SightingsEditor';
import { ButterflyIcon, BirdIcon, MushroomIcon, SpiderIcon, BatIcon, MammalIcon, ReptileIcon, AmphibianIcon, MothIcon, BugIcon, LeafIcon, BeeIcon, BeetleIcon, FlyIcon, GrasshopperIcon, DragonflyIcon, EarwigIcon } from '../components/icons/WildlifeIcons';
import { PageHeader } from '../components/layout/PageHeader';

/**
 * SurveyDetailPage displays detailed information about a single survey
 * - Survey metadata (date, surveyors, location, notes)
 * - Sightings with card-based editing interface
 * - View/Edit mode toggle with action buttons
 *
 * Following DEVELOPMENT.md conventions:
 * - Built inline first (no premature component extraction)
 * - Uses MUI components with theme integration
 * - Connected to real API
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
  const [breedingCodes, setBreedingCodes] = useState<BreedingStatusCode[]>([]);
  const [locationsWithBoundaries, setLocationsWithBoundaries] = useState<LocationWithBoundary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // ============================================================================
  // Edit Mode State
  // ============================================================================

  const [editDate, setEditDate] = useState<Dayjs | null>(null);
  const [editLocationId, setEditLocationId] = useState<number | null>(null);
  const [editSelectedSurveyors, setEditSelectedSurveyors] = useState<Surveyor[]>([]);
  const [editNotes, setEditNotes] = useState<string>('');
  const [editDraftSightings, setEditDraftSightings] = useState<DraftSighting[]>([]);

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
      if (!id) {
        setError('No survey ID provided');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Fetch all data in parallel
        const [surveyData, sightingsData, surveyorsData, locationsData, speciesData, breedingCodesData, boundariesData] = await Promise.all([
          surveysAPI.getById(Number(id)),
          surveysAPI.getSightings(Number(id)),
          surveyorsAPI.getAll(),
          locationsAPI.getAll(),
          speciesAPI.getAll(),
          surveysAPI.getBreedingCodes(),
          locationsAPI.getAllWithBoundaries(),
        ]);

        setSurvey(surveyData);
        setSightings(sightingsData);
        setSurveyors(surveyorsData);
        setLocations(locationsData);
        setSpecies(speciesData);
        setBreedingCodes(breedingCodesData);
        setLocationsWithBoundaries(boundariesData);
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
   * Get species display name from ID
   */
  const getSpeciesName = (id: number): string => {
    const speciesItem = species.find(s => s.id === id);
    if (!speciesItem) return 'Unknown';
    if (speciesItem.name) {
      return `${speciesItem.name}${speciesItem.scientific_name ? ' ' + speciesItem.scientific_name : ''}`;
    }
    return speciesItem.scientific_name || 'Unknown';
  };

  /**
   * Format date from YYYY-MM-DD to readable format
   */
  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  /**
   * Get icon component for species type
   */
  const getSpeciesIcon = (type: string) => {
    switch (type) {
      case 'butterfly':
        return ButterflyIcon;
      case 'bird':
        return BirdIcon;
      case 'moth':
        return MothIcon;
      case 'beetle':
        return BeetleIcon;
      case 'fly':
        return FlyIcon;
      case 'bee-wasp-ant':
        return BeeIcon;
      case 'bug':
        return BugIcon;
      case 'dragonfly-damselfly':
        return DragonflyIcon;
      case 'grasshopper-cricket':
        return GrasshopperIcon;
      case 'insect':
        return EarwigIcon;
      case 'gall':
        return LeafIcon;
      case 'spider':
        return SpiderIcon;
      case 'bat':
        return BatIcon;
      case 'mammal':
        return MammalIcon;
      case 'reptile':
        return ReptileIcon;
      case 'amphibian':
        return AmphibianIcon;
      case 'fungi':
        return MushroomIcon;
      default:
        return EarwigIcon; // Default fallback
    }
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
  // Validation
  // ============================================================================

  const validate = (): boolean => {
    const errors: typeof validationErrors = {};

    if (!editDate) {
      errors.date = 'Date is required';
    }

    if (!editLocationId) {
      errors.location = 'Location is required';
    }

    if (editSelectedSurveyors.length === 0) {
      errors.surveyors = 'At least one surveyor is required';
    }

    // Check for at least one valid sighting
    const validSightings = editDraftSightings.filter(
      (s) => s.species_id !== null && s.count > 0
    );
    if (validSightings.length === 0) {
      errors.sightings = 'At least one sighting is required';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // ============================================================================
  // Event Handlers
  // ============================================================================

  const handleEditClick = () => {
    if (!survey) return;

    // Populate edit state with current survey data
    setEditDate(dayjs(survey.date));
    setEditLocationId(survey.location_id);
    setEditSelectedSurveyors(
      surveyors.filter((s) => survey.surveyor_ids.includes(s.id))
    );
    setEditNotes(survey.notes || '');

    // Convert existing sightings to DraftSighting format
    // Note: sightings may include individuals array from API (SightingWithIndividuals)
    const draftSightings: DraftSighting[] = sightings.map((sighting: any) => ({
      tempId: `existing-${sighting.id}`,
      species_id: sighting.species_id,
      count: sighting.count,
      id: sighting.id, // Keep the real ID for updates/deletes
      // Include individuals if present (from SightingWithIndividuals)
      individuals: sighting.individuals?.map((ind: any) => ({
        ...ind,
        tempId: `existing-ind-${ind.id}`,
      })),
    }));

    // Add one empty row at the end
    draftSightings.push({
      tempId: `temp-${Date.now()}`,
      species_id: null,
      count: 1,
    });

    setEditDraftSightings(draftSightings);
    setValidationErrors({});
    setIsEditMode(true);
  };

  const handleSave = async () => {
    // Validate survey fields
    if (!validate()) {
      setError('Please fill in all required fields');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // Step 1: Update survey
      const surveyData: Partial<Survey> = {
        date: editDate!.format('YYYY-MM-DD'),
        location_id: editLocationId!,
        surveyor_ids: editSelectedSurveyors.map((s) => s.id),
        type: 'butterfly', // Keep existing type
        notes: editNotes.trim() || null,
      };

      await surveysAPI.update(Number(id), surveyData);

      // Step 2: Handle sightings changes
      // Get valid sightings (non-empty rows)
      const validSightings = editDraftSightings.filter(
        (s) => s.species_id !== null && s.count > 0
      );

      // Identify which sightings to delete (existing sightings not in the new list)
      const existingSightingIds = sightings.map((s) => s.id);
      const keptSightingIds = validSightings
        .filter((s) => s.id)
        .map((s) => s.id!);
      const sightingsToDelete = existingSightingIds.filter(
        (id) => !keptSightingIds.includes(id)
      );

      // Delete removed sightings
      await Promise.all(
        sightingsToDelete.map((sightingId) =>
          surveysAPI.deleteSighting(Number(id), sightingId)
        )
      );

      // Update existing sightings and add new ones
      await Promise.all(
        validSightings.map((sighting) => {
          if (sighting.id) {
            // Update existing sighting
            return surveysAPI.updateSighting(Number(id), sighting.id, {
              species_id: sighting.species_id!,
              count: sighting.count,
            });
            // Note: Individual locations are managed separately via the individuals endpoints
          } else {
            // Add new sighting with individual locations
            return surveysAPI.addSighting(Number(id), {
              species_id: sighting.species_id!,
              count: sighting.count,
              individuals: sighting.individuals?.map((ind) => ({
                latitude: ind.latitude,
                longitude: ind.longitude,
                breeding_status_code: ind.breeding_status_code,
                notes: ind.notes,
              })),
            });
          }
        })
      );

      // Success - navigate back to surveys list with edited parameter
      navigate(`/surveys?edited=${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update survey');
      console.error('Error updating survey:', err);
      setSaving(false);
    }
  };

  const handleCancel = () => {
    // Clear edit state and validation errors
    setEditDate(null);
    setEditLocationId(null);
    setEditSelectedSurveyors([]);
    setEditNotes('');
    setEditDraftSightings([]);
    setValidationErrors({});
    setError(null);
    setIsEditMode(false);
  };

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
  };

  const handleDeleteCancel = () => {
    setShowDeleteConfirm(false);
  };

  const handleDeleteConfirm = async () => {
    if (!id) return;

    setDeleting(true);
    setError(null);

    try {
      await surveysAPI.delete(Number(id));

      // Success - navigate back to surveys list with deleted parameter
      navigate(`/surveys?deleted=${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete survey');
      console.error('Error deleting survey:', err);
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleSightingsChange = (newSightings: DraftSighting[]) => {
    setEditDraftSightings(newSightings);

    // Clear sightings validation error when user changes sightings
    if (validationErrors.sightings) {
      setValidationErrors({ ...validationErrors, sightings: undefined });
    }
  };

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <Box sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
      {/* Page Header */}
      <PageHeader
        backButton={{ href: '/surveys' }}
        actions={
          <>
            {/* TODO: Add RBAC permission checks - only show these buttons to admin users */}
            {/* When implementing: const { hasPermission } = useAuth(); */}
            {/* Then wrap buttons with: {hasPermission('edit_survey') && <Button.../>} */}
            {isEditMode ? (
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
                    !editDate ||
                    !editLocationId ||
                    editSelectedSurveyors.length === 0 ||
                    editDraftSightings.filter((s) => s.species_id !== null && s.count > 0).length === 0
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
                    '&:hover': { boxShadow: 'none' },
                  }}
                >
                  Edit
                </Button>
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<Delete />}
                  onClick={handleDeleteClick}
                  sx={{
                    textTransform: 'none',
                    fontWeight: 600,
                    boxShadow: 'none',
                  }}
                >
                  Delete
                </Button>
              </Stack>
            )}
          </>
        }
      />

      {/* Error Alert */}
      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

        {/* Survey Metadata Card */}
        <Paper
          sx={{
            p: { xs: 2, sm: 2.5, md: 3 },
            mb: { xs: 2, md: 3 },
            boxShadow: 'none',
            border: '1px solid',
            borderColor: 'divider'
          }}
        >
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
            {isEditMode ? 'Survey Details' : 'Survey Information'}
          </Typography>

          {isEditMode ? (
            <SurveyFormFields
              date={editDate}
              locationId={editLocationId}
              selectedSurveyors={editSelectedSurveyors}
              notes={editNotes}
              locations={locations}
              surveyors={surveyors}
              onDateChange={setEditDate}
              onLocationChange={setEditLocationId}
              onSurveyorsChange={setEditSelectedSurveyors}
              onNotesChange={setEditNotes}
              validationErrors={validationErrors}
            />
          ) : (
            <Stack spacing={2}>
              {/* Date */}
              <Box>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                  <CalendarToday sx={{ fontSize: 18, color: 'text.secondary' }} />
                  <Typography variant="body2" color="text.secondary" fontWeight={500}>
                    Date
                  </Typography>
                </Stack>
                <Typography variant="body1">{formatDate(survey.date)}</Typography>
              </Box>

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

              {/* Location */}
              <Box>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                  <LocationOn sx={{ fontSize: 18, color: 'text.secondary' }} />
                  <Typography variant="body2" color="text.secondary" fontWeight={500}>
                    Location
                  </Typography>
                </Stack>
                <Typography variant="body1">{getLocationName(survey.location_id)}</Typography>
              </Box>

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
          )}
        </Paper>

        {/* Sightings Section */}
        <Paper
          sx={{
            p: { xs: 2, sm: 2.5, md: 3 },
            boxShadow: 'none',
            border: '1px solid',
            borderColor: 'divider'
          }}
        >
          {isEditMode ? (
            <SightingsEditor
              sightings={editDraftSightings}
              species={species}
              breedingCodes={breedingCodes}
              onSightingsChange={handleSightingsChange}
              validationError={validationErrors.sightings}
              locationsWithBoundaries={locationsWithBoundaries}
            />
          ) : (
            <>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                Sightings ({sightings.length})
              </Typography>

              {/* Sightings Table */}
              {sightings.length > 0 ? (
                <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
                  {/* Table Header - Hidden on mobile */}
                  <Box
                    sx={{
                      display: { xs: 'none', sm: 'grid' },
                      gridTemplateColumns: '3fr 90px 1fr',
                      gap: { sm: 1.5, md: 2 },
                      p: { sm: 1, md: 1.5 },
                      bgcolor: 'grey.50',
                      borderBottom: '1px solid',
                      borderColor: 'divider'
                    }}
                  >
                    <Typography variant="body2" fontWeight={600} color="text.secondary">
                      SPECIES
                    </Typography>
                    <Typography variant="body2" fontWeight={600} color="text.secondary" textAlign="center">
                      LOCATION
                    </Typography>
                    <Typography variant="body2" fontWeight={600} color="text.secondary">
                      COUNT
                    </Typography>
                  </Box>

                  {/* Table Rows - Grouped by Species Type */}
                  {(() => {
                    // Group sightings by species type
                    const grouped = sightings.reduce((acc, sighting) => {
                      const speciesItem = species.find(s => s.id === sighting.species_id);
                      const type = speciesItem?.type || 'unknown';
                      if (!acc[type]) acc[type] = [];
                      acc[type].push(sighting);
                      return acc;
                    }, {} as Record<string, typeof sightings>);

                    // Sort groups alphabetically by type name
                    const sortedGroups = Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b));

                    // Format type name for display
                    const formatTypeName = (type: string) =>
                      type.charAt(0).toUpperCase() + type.slice(1);

                    return sortedGroups.map(([type, groupSightings], groupIndex) => {
                      const SpeciesIcon = getSpeciesIcon(type);

                      return (
                        <Box key={type}>
                          {/* Group Divider and Label */}
                          <Box
                            sx={{
                              borderTop: groupIndex > 0 ? '1px solid' : 'none',
                              borderColor: 'divider',
                              bgcolor: 'grey.50',
                              px: { xs: 1, sm: 1.25, md: 1.5 },
                              py: { xs: 0.75, sm: 1 },
                              mt: groupIndex > 0 ? 2 : 0
                            }}
                          >
                            <Stack direction="row" alignItems="center" spacing={0.75}>
                              <SpeciesIcon sx={{ fontSize: { xs: '14px', sm: '16px' }, color: 'text.secondary' }} />
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                fontWeight={600}
                                sx={{ fontSize: { xs: '0.688rem', sm: '0.75rem' }, letterSpacing: '0.05em' }}
                              >
                                {formatTypeName(type)} · {groupSightings.length}
                              </Typography>
                            </Stack>
                          </Box>

                        {/* Group Rows */}
                        {groupSightings.map((sighting: any) => {
                          // Check for individual locations
                          const individualsWithLocation = sighting.individuals?.filter(
                            (ind: any) => ind.latitude !== null && ind.latitude !== undefined &&
                                          ind.longitude !== null && ind.longitude !== undefined
                          ) || [];
                          const hasLocation = individualsWithLocation.length > 0;

                          const locationTooltip = hasLocation
                            ? `${individualsWithLocation.length} of ${sighting.count} individual${sighting.count > 1 ? 's' : ''} located`
                            : 'No location recorded';

                          return (
                            <Box
                              key={sighting.id}
                              sx={{
                                display: 'grid',
                                gridTemplateColumns: '3fr 90px 1fr',
                                gap: { xs: 1, sm: 1.5, md: 2 },
                                p: { xs: 1, sm: 1.25, md: 1.5 },
                                borderBottom: '1px solid',
                                borderColor: 'divider',
                                '&:hover': { bgcolor: 'grey.50' }
                              }}
                            >
                              <Typography variant="body2" sx={{ fontSize: { xs: '0.813rem', sm: '0.875rem' } }}>
                                {sighting.species_name ? (
                                  <>
                                    {sighting.species_name}
                                    {sighting.species_scientific_name && (
                                      <i style={{ color: '#666', marginLeft: '0.25rem' }}> {sighting.species_scientific_name}</i>
                                    )}
                                  </>
                                ) : (
                                  <i style={{ color: '#666' }}>{sighting.species_scientific_name || getSpeciesName(sighting.species_id)}</i>
                                )}
                              </Typography>

                              {/* Location Column - Only show if location exists */}
                              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5, justifySelf: 'center' }}>
                                {hasLocation && (
                                  <Tooltip title={locationTooltip} arrow>
                                    <span>
                                      <LocationOn sx={{ fontSize: 24, color: 'primary.main' }} />
                                    </span>
                                  </Tooltip>
                                )}
                              </Box>

                              <Typography variant="body2" fontWeight={600} sx={{ fontSize: { xs: '0.813rem', sm: '0.875rem' } }}>
                                {sighting.count}
                              </Typography>
                            </Box>
                          );
                        })}
                        </Box>
                      );
                    })
                  })()}
                </Box>
              ) : (
                <Typography color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
                  No sightings recorded yet.
                </Typography>
              )}
            </>
          )}
        </Paper>

        {/* Delete Confirmation Dialog */}
        <Dialog
          open={showDeleteConfirm}
          onClose={handleDeleteCancel}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>Delete Survey?</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Are you sure you want to delete this survey from {formatDate(survey.date)} at {getLocationName(survey.location_id)}?
              <br /><br />
              This action cannot be undone. All sightings associated with this survey will also be deleted.
            </DialogContentText>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button
              onClick={handleDeleteCancel}
              disabled={deleting}
              sx={{ textTransform: 'none', fontWeight: 600 }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDeleteConfirm}
              color="error"
              variant="contained"
              disabled={deleting}
              sx={{ textTransform: 'none', fontWeight: 600, boxShadow: 'none' }}
            >
              {deleting ? (
                <>
                  <CircularProgress size={20} sx={{ mr: 1 }} />
                  Deleting...
                </>
              ) : (
                'Delete Survey'
              )}
            </Button>
          </DialogActions>
        </Dialog>
    </Box>
  );
}
