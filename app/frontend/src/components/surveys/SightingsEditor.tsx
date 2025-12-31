import { useState, useMemo } from 'react';
import { Box, Typography, TextField, Autocomplete, IconButton, Alert, Stack, Card, CardContent, Button, Chip, Tooltip } from '@mui/material';
import { Delete, Edit, Add, LocationOnOutlined, PinDrop } from '@mui/icons-material';
import type { Species, BreedingStatusCode, LocationWithBoundary } from '../../services/api';
import { AddSightingModal } from './AddSightingModal';
import type { SightingData } from './AddSightingModal';
import { LocationModal } from './LocationModal';
import { ButterflyIcon, BirdIcon, MushroomIcon, SpiderIcon, BatIcon, MammalIcon, ReptileIcon, AmphibianIcon, MothIcon, BugIcon, LeafIcon, BeeIcon, BeetleIcon, FlyIcon, GrasshopperIcon, DragonflyIcon, EarwigIcon } from '../icons/WildlifeIcons';
import { useResponsive } from '../../hooks/useResponsive';
import type { DraftIndividualLocation } from './MultiLocationMapPicker';

export interface DraftSighting {
  tempId: string;
  species_id: number | null;
  count: number;
  latitude?: number | null;
  longitude?: number | null;
  id?: number;
  // Per-individual location points with breeding status (new)
  individuals?: DraftIndividualLocation[];
}

interface SightingsEditorProps {
  sightings: DraftSighting[];
  species: Species[];
  breedingCodes?: BreedingStatusCode[];
  onSightingsChange: (sightings: DraftSighting[]) => void;
  validationError?: string;
  locationsWithBoundaries?: LocationWithBoundary[]; // Optional locations with boundaries to display on maps
}

/**
 * SightingsEditor - Responsive editor for survey sightings
 *
 * Mobile (xs/sm): Card-based UI with modal for add/edit
 * Desktop (md+): Inline table editing with all fields visible
 */
export function SightingsEditor({
  sightings,
  species,
  breedingCodes = [],
  onSightingsChange,
  validationError,
  locationsWithBoundaries,
}: SightingsEditorProps) {
  const { isMobile } = useResponsive();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingTempId, setEditingTempId] = useState<string | null>(null);
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [locationEditingTempId, setLocationEditingTempId] = useState<string | null>(null);

  // Sort species by type first, then by name within each type
  const sortedSpecies = useMemo(() => {
    return [...species].sort((a, b) => {
      if (a.type !== b.type) {
        return a.type.localeCompare(b.type);
      }
      const nameA = a.name || a.scientific_name || '';
      const nameB = b.name || b.scientific_name || '';
      return nameA.localeCompare(nameB);
    });
  }, [species]);

  // Format category name for display
  const formatCategoryName = (category: string): string => {
    return category.charAt(0).toUpperCase() + category.slice(1);
  };

  // Get icon component for species type
  const getSpeciesIcon = (type: string) => {
    switch (type) {
      case 'butterfly': return ButterflyIcon;
      case 'bird': return BirdIcon;
      case 'moth': return MothIcon;
      case 'beetle': return BeetleIcon;
      case 'fly': return FlyIcon;
      case 'bee-wasp-ant': return BeeIcon;
      case 'bug': return BugIcon;
      case 'dragonfly-damselfly': return DragonflyIcon;
      case 'grasshopper-cricket': return GrasshopperIcon;
      case 'insect': return EarwigIcon;
      case 'gall': return LeafIcon;
      case 'spider': return SpiderIcon;
      case 'bat': return BatIcon;
      case 'mammal': return MammalIcon;
      case 'reptile': return ReptileIcon;
      case 'amphibian': return AmphibianIcon;
      case 'fungi': return MushroomIcon;
      default: return EarwigIcon;
    }
  };

  // Modal handlers (for mobile)
  const handleAddClick = () => {
    setEditingTempId(null);
    setModalOpen(true);
  };

  const handleEditClick = (tempId: string) => {
    setEditingTempId(tempId);
    setModalOpen(true);
  };

  const handleModalClose = () => {
    setModalOpen(false);
    setEditingTempId(null);
  };

  const handleModalSave = (sightingData: SightingData) => {
    if (editingTempId) {
      const updatedSightings = sightings.map((s) =>
        s.tempId === editingTempId
          ? {
              ...s,
              species_id: sightingData.species_id,
              count: sightingData.count,
              latitude: sightingData.latitude,
              longitude: sightingData.longitude,
              individuals: sightingData.individuals,
            }
          : s
      );
      onSightingsChange(updatedSightings);
    } else {
      onSightingsChange([
        ...sightings,
        {
          tempId: `temp-${Date.now()}`,
          species_id: sightingData.species_id,
          count: sightingData.count,
          latitude: sightingData.latitude,
          longitude: sightingData.longitude,
          individuals: sightingData.individuals,
        },
      ]);
    }
  };

  // Inline editing handlers (for desktop)
  const addSightingRow = () => {
    onSightingsChange([
      ...sightings,
      {
        tempId: `temp-${Date.now()}`,
        species_id: null,
        count: 1,
      },
    ]);
  };

  const removeSightingRow = (tempId: string) => {
    if (sightings.length > 1) {
      onSightingsChange(sightings.filter((s) => s.tempId !== tempId));
    }
  };

  const updateSighting = (tempId: string, field: keyof DraftSighting, value: any) => {
    const isLastRow = sightings[sightings.length - 1].tempId === tempId;
    const shouldAutoAdd = field === 'species_id' && value !== null && isLastRow;

    const updatedSightings = sightings.map((s) =>
      s.tempId === tempId ? { ...s, [field]: value } : s
    );

    if (shouldAutoAdd) {
      onSightingsChange([
        ...updatedSightings,
        {
          tempId: `temp-${Date.now()}`,
          species_id: null,
          count: 1,
        },
      ]);
    } else {
      onSightingsChange(updatedSightings);
    }
  };

  const getSpeciesDisplayName = (speciesId: number | null): string => {
    const sp = species.find((s) => s.id === speciesId);
    if (!sp) return 'Unknown';
    if (sp.name) {
      return sp.scientific_name ? `${sp.name} (${sp.scientific_name})` : sp.name;
    }
    return sp.scientific_name || 'Unknown';
  };

  const getSpeciesType = (speciesId: number | null): string => {
    const sp = species.find((s) => s.id === speciesId);
    return sp?.type || 'insect';
  };

  // Location modal handlers
  const handleLocationClick = (tempId: string) => {
    setLocationEditingTempId(tempId);
    setLocationModalOpen(true);
  };

  const handleLocationModalClose = () => {
    setLocationModalOpen(false);
    setLocationEditingTempId(null);
  };

  const handleLocationSave = (individuals: DraftIndividualLocation[]) => {
    if (locationEditingTempId) {
      const updatedSightings = sightings.map((s) =>
        s.tempId === locationEditingTempId
          ? {
              ...s,
              // Clear legacy single location when using individuals
              latitude: null,
              longitude: null,
              individuals: individuals,
            }
          : s
      );
      onSightingsChange(updatedSightings);
    }
  };

  const validSightings = sightings.filter((s) => s.species_id !== null);
  const editingSighting = editingTempId ? sightings.find((s) => s.tempId === editingTempId) : null;
  const locationEditingSighting = locationEditingTempId ? sightings.find((s) => s.tempId === locationEditingTempId) : null;

  // Mobile UI: Cards + Modal
  if (isMobile) {
    return (
      <>
        <Box sx={{ mb: 2 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Sightings ({validSightings.length})
            </Typography>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={handleAddClick}
              sx={{
                textTransform: 'none',
                fontWeight: 600,
                boxShadow: 'none',
                '&:hover': { boxShadow: 'none' }
              }}
            >
              Add Sighting
            </Button>
          </Stack>

          {validationError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {validationError}
            </Alert>
          )}

          {validSightings.length > 0 ? (
            <Stack spacing={1.5}>
              {validSightings.map((sighting) => {
                const SpeciesIcon = getSpeciesIcon(getSpeciesType(sighting.species_id));
                const speciesName = getSpeciesDisplayName(sighting.species_id);

                return (
                  <Card
                    key={sighting.tempId}
                    variant="outlined"
                    sx={{
                      border: '1px solid',
                      borderColor: 'divider',
                      boxShadow: 'none',
                    }}
                  >
                    <CardContent
                      sx={{
                        p: 1.5,
                        '&:last-child': { pb: 1.5 },
                      }}
                    >
                      <Stack direction="row" alignItems="center" spacing={2}>
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 40,
                            height: 40,
                            borderRadius: 1,
                            bgcolor: 'grey.100',
                            flexShrink: 0,
                          }}
                        >
                          <SpeciesIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
                        </Box>

                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography
                            variant="body1"
                            sx={{
                              fontWeight: 500,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'normal',
                              fontSize: '0.95rem',
                            }}
                          >
                            {speciesName}
                          </Typography>
                          <Chip
                            label={`Count: ${sighting.count}`}
                            size="small"
                            sx={{
                              mt: 0.5,
                              height: 24,
                              fontSize: '0.75rem',
                              bgcolor: 'primary.main',
                              color: 'white',
                              fontWeight: 600,
                            }}
                          />
                        </Box>

                        <Stack direction="row" spacing={0.5}>
                          <IconButton
                            size="small"
                            onClick={() => handleEditClick(sighting.tempId)}
                            sx={{ color: 'primary.main' }}
                          >
                            <Edit fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => removeSightingRow(sighting.tempId)}
                            sx={{ color: 'error.main' }}
                          >
                            <Delete fontSize="small" />
                          </IconButton>
                        </Stack>
                      </Stack>
                    </CardContent>
                  </Card>
                );
              })}
            </Stack>
          ) : (
            <Box
              sx={{
                p: 4,
                textAlign: 'center',
                border: '2px dashed',
                borderColor: 'divider',
                borderRadius: 1,
                bgcolor: 'grey.50',
              }}
            >
              <Typography variant="body2" color="text.secondary">
                No sightings added yet. Click "Add Sighting" to get started.
              </Typography>
            </Box>
          )}
        </Box>

        <AddSightingModal
          open={modalOpen}
          onClose={handleModalClose}
          onSave={handleModalSave}
          species={species}
          breedingCodes={breedingCodes}
          initialData={
            editingSighting
              ? {
                  species_id: editingSighting.species_id,
                  count: editingSighting.count,
                  latitude: editingSighting.latitude,
                  longitude: editingSighting.longitude,
                  individuals: editingSighting.individuals,
                }
              : undefined
          }
          mode={editingTempId ? 'edit' : 'add'}
          locationsWithBoundaries={locationsWithBoundaries}
        />
      </>
    );
  }

  // Desktop UI: Inline Table Editing
  return (
    <>
      <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
        Sightings ({validSightings.length})
      </Typography>

      {validationError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {validationError}
        </Alert>
      )}

      {sightings.length > 0 ? (
        <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: '3fr 90px 110px 80px',
              gap: 2,
              p: 1.5,
              bgcolor: 'grey.50',
              borderBottom: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Typography variant="body2" fontWeight={600} color="text.secondary">
              SPECIES *
            </Typography>
            <Typography variant="body2" fontWeight={600} color="text.secondary" textAlign="center">
              LOCATION
            </Typography>
            <Typography variant="body2" fontWeight={600} color="text.secondary">
              COUNT *
            </Typography>
            <Typography variant="body2" fontWeight={600} color="text.secondary" textAlign="center">
              ACTIONS
            </Typography>
          </Box>

          {sightings.map((sighting, index) => {
            const isLastRow = index === sightings.length - 1;
            const isEmpty = sighting.species_id === null;
            const isEmptyLastRow = isLastRow && isEmpty;

            const individualCount = sighting.individuals?.length || 0;
            const hasLocations = individualCount > 0;
            const locationTooltip = hasLocations
              ? `${individualCount} of ${sighting.count} individual${sighting.count > 1 ? 's' : ''} located`
              : `Click to add locations (0 of ${sighting.count})`;

            return (
              <Box
                key={sighting.tempId}
                sx={{
                  display: 'grid',
                  gridTemplateColumns: '3fr 90px 110px 80px',
                  gap: 2,
                  p: 1.5,
                  borderBottom: index < sightings.length - 1 ? '1px solid' : 'none',
                  borderColor: 'divider',
                  alignItems: 'center',
                  bgcolor: isEmptyLastRow ? 'grey.50' : 'transparent',
                  transition: 'background-color 0.2s',
                }}
              >
                <Autocomplete
                  options={sortedSpecies}
                  groupBy={(option) => formatCategoryName(option.type)}
                  renderGroup={(params) => {
                    const type = params.group.toLowerCase();
                    const SpeciesIcon = getSpeciesIcon(type);

                    return (
                      <li key={params.key}>
                        <Box sx={{ px: 2, py: 1, bgcolor: 'grey.50', borderBottom: '1px solid', borderColor: 'divider' }}>
                          <Stack direction="row" alignItems="center" spacing={1}>
                            <SpeciesIcon sx={{ fontSize: '16px', color: 'text.secondary' }} />
                            <Typography variant="body2" fontWeight={600} color="text.secondary">
                              {params.group}
                            </Typography>
                          </Stack>
                        </Box>
                        <ul style={{ padding: 0, margin: 0 }}>{params.children}</ul>
                      </li>
                    );
                  }}
                  getOptionLabel={(option) => {
                    if (option.name) {
                      return `${option.name} ${option.scientific_name || ''}`.trim();
                    }
                    return option.scientific_name || '';
                  }}
                  value={species.find((s) => s.id === sighting.species_id) || null}
                  onChange={(_, newValue) =>
                    updateSighting(sighting.tempId, 'species_id', newValue?.id || null)
                  }
                  renderOption={(props, option) => (
                    <li {...props}>
                      {option.name ? (
                        <>
                          {option.name}
                          {option.scientific_name && (
                            <i style={{ color: '#666', marginLeft: '0.5rem' }}>{option.scientific_name}</i>
                          )}
                        </>
                      ) : (
                        <i style={{ color: '#666' }}>{option.scientific_name}</i>
                      )}
                    </li>
                  )}
                  renderInput={(params) => {
                    const selectedSpecies = species.find((s) => s.id === sighting.species_id);
                    const hasSelection = selectedSpecies !== undefined && selectedSpecies !== null;

                    return (
                      <TextField
                        {...params}
                        placeholder={isEmptyLastRow ? 'Start typing to add sighting...' : 'Select species'}
                        size="small"
                        InputProps={{
                          ...params.InputProps,
                          startAdornment: hasSelection && params.inputProps.value ? (
                            <Box
                              component="span"
                              sx={{
                                position: 'absolute',
                                left: 14,
                                pointerEvents: 'none',
                                fontSize: '0.875rem',
                                color: 'text.primary',
                              }}
                            >
                              {selectedSpecies.name ? (
                                <>
                                  {selectedSpecies.name}
                                  {selectedSpecies.scientific_name && (
                                    <i style={{ color: '#666', marginLeft: '0.25rem' }}> {selectedSpecies.scientific_name}</i>
                                  )}
                                </>
                              ) : (
                                <i style={{ color: '#666' }}>{selectedSpecies.scientific_name}</i>
                              )}
                            </Box>
                          ) : null,
                        }}
                        sx={{
                          '& .MuiInputBase-input': {
                            fontSize: '0.875rem',
                            padding: '8.5px 14px',
                            color: hasSelection && params.inputProps.value ? 'transparent' : 'inherit',
                          }
                        }}
                      />
                    );
                  }}
                  size="small"
                />

                {/* Location Column */}
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
                  <Tooltip title={locationTooltip} arrow>
                    <IconButton
                      size="small"
                      onClick={() => handleLocationClick(sighting.tempId)}
                      disabled={isEmptyLastRow}
                      sx={{
                        color: hasLocations ? 'primary.main' : 'text.disabled',
                        '&:hover': {
                          bgcolor: hasLocations ? 'primary.light' : 'action.hover',
                        },
                      }}
                    >
                      {hasLocations ? (
                        <PinDrop sx={{ fontSize: 24 }} />
                      ) : (
                        <LocationOnOutlined sx={{ fontSize: 24 }} />
                      )}
                    </IconButton>
                  </Tooltip>
                </Box>

                <TextField
                  type="number"
                  value={sighting.count}
                  onChange={(e) =>
                    updateSighting(sighting.tempId, 'count', Math.max(1, parseInt(e.target.value) || 1))
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && sighting.species_id !== null) {
                      e.preventDefault();
                      addSightingRow();
                    }
                    if (e.key === 'Tab' && !e.shiftKey && isLastRow && sighting.species_id !== null) {
                      if (isEmpty) {
                        addSightingRow();
                      }
                    }
                  }}
                  size="small"
                  inputProps={{ min: 1 }}
                  placeholder="#"
                  sx={{
                    '& .MuiInputBase-input': {
                      fontSize: '0.875rem',
                      padding: '8.5px 14px'
                    }
                  }}
                />

                <IconButton
                  size="small"
                  color="error"
                  onClick={() => removeSightingRow(sighting.tempId)}
                  disabled={sightings.length === 1}
                  sx={{
                    justifySelf: 'center',
                    opacity: isEmptyLastRow ? 0.3 : 1,
                    width: 40,
                    height: 40,
                  }}
                >
                  <Delete sx={{ fontSize: 20 }} />
                </IconButton>
              </Box>
            );
          })}
        </Box>
      ) : null}

      {/* Location Modal */}
      <LocationModal
        open={locationModalOpen}
        onClose={handleLocationModalClose}
        onSave={handleLocationSave}
        initialIndividuals={locationEditingSighting?.individuals}
        speciesName={
          locationEditingSighting?.species_id
            ? getSpeciesDisplayName(locationEditingSighting.species_id)
            : undefined
        }
        speciesType={
          locationEditingSighting?.species_id
            ? getSpeciesType(locationEditingSighting.species_id)
            : undefined
        }
        breedingCodes={breedingCodes}
        count={locationEditingSighting?.count || 1}
        locationsWithBoundaries={locationsWithBoundaries}
      />
    </>
  );
}
