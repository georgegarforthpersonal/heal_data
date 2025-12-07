import { useMemo } from 'react';
import { Box, Typography, TextField, Autocomplete, IconButton, Alert, Stack } from '@mui/material';
import { Delete } from '@mui/icons-material';
import type { Species } from '../../services/api';
import { ButterflyIcon, BirdIcon, MushroomIcon, SpiderIcon, BatIcon, MammalIcon, ReptileIcon, AmphibianIcon, MothIcon, BugIcon, LeafIcon } from '../icons/WildlifeIcons';

export interface DraftSighting {
  tempId: string; // Temporary ID for draft sightings (before save)
  species_id: number | null;
  count: number;
  id?: number; // Real ID if this is an existing sighting being edited
}

interface SightingsEditorProps {
  sightings: DraftSighting[];
  species: Species[];
  onSightingsChange: (sightings: DraftSighting[]) => void;
  validationError?: string;
}

/**
 * SightingsEditor - Inline editor for survey sightings
 *
 * Features:
 * - Add/edit/delete sightings before saving
 * - Auto-adds new row when last row is filled
 * - Always keeps at least one row
 * - Inline validation
 * - Grouped by species type with section headers
 */
export function SightingsEditor({
  sightings,
  species,
  onSightingsChange,
  validationError,
}: SightingsEditorProps) {

  // Sort species by type first, then by name (or scientific_name if name is null) within each type
  const sortedSpecies = useMemo(() => {
    return [...species].sort((a, b) => {
      // First sort by type
      if (a.type !== b.type) {
        return a.type.localeCompare(b.type);
      }
      // Then sort by name within the same type (use scientific_name if name is null)
      const nameA = a.name || a.scientific_name || '';
      const nameB = b.name || b.scientific_name || '';
      return nameA.localeCompare(nameB);
    });
  }, [species]);

  // Format category name for display (capitalize first letter)
  const formatCategoryName = (category: string): string => {
    return category.charAt(0).toUpperCase() + category.slice(1);
  };

  // Get icon component for species type
  const getSpeciesIcon = (type: string) => {
    switch (type) {
      case 'butterfly':
        return ButterflyIcon;
      case 'bird':
        return BirdIcon;
      case 'moth':
        return MothIcon;
      case 'insect':
        return BugIcon;
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
        return BugIcon; // Default fallback
    }
  };

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
    // Always keep at least one row
    if (sightings.length > 1) {
      onSightingsChange(sightings.filter((s) => s.tempId !== tempId));
    }
  };

  const updateSighting = (tempId: string, field: keyof DraftSighting, value: any) => {
    // Check if this is the last row BEFORE updating
    const isLastRow = sightings[sightings.length - 1].tempId === tempId;
    const shouldAutoAdd = field === 'species_id' && value !== null && isLastRow;

    // Update the sighting
    const updatedSightings = sightings.map((s) =>
      s.tempId === tempId ? { ...s, [field]: value } : s
    );

    // If we should auto-add, add the new row immediately
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

  return (
    <>
      <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
        Sightings ({sightings.filter((s) => s.species_id !== null).length})
      </Typography>

      {/* Validation Error */}
      {validationError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {validationError}
        </Alert>
      )}

      {/* Sightings Table */}
      {sightings.length > 0 ? (
        <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
          {/* Table Header - Hidden on mobile */}
          <Box
            sx={{
              display: { xs: 'none', sm: 'grid' },
              gridTemplateColumns: { sm: '3fr 100px 48px', md: '3fr 120px 60px' },
              gap: { sm: 1, md: 2 },
              p: { sm: 1, md: 1.5 },
              bgcolor: 'grey.50',
              borderBottom: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Typography variant="body2" fontWeight={600} color="text.secondary">
              SPECIES *
            </Typography>
            <Typography variant="body2" fontWeight={600} color="text.secondary">
              COUNT *
            </Typography>
            <Typography variant="body2" fontWeight={600} color="text.secondary" textAlign="center">
              ACTIONS
            </Typography>
          </Box>

          {/* Table Rows */}
          {sightings.map((sighting, index) => {
            const isLastRow = index === sightings.length - 1;
            const isEmpty = sighting.species_id === null;
            const isEmptyLastRow = isLastRow && isEmpty;

            return (
              <Box
                key={sighting.tempId}
                sx={{
                  display: { xs: 'flex', sm: 'grid' },
                  flexDirection: { xs: 'column', sm: 'row' },
                  gridTemplateColumns: { sm: '3fr 100px 48px', md: '3fr 120px 60px' },
                  gap: { xs: 1, sm: 1, md: 2 },
                  p: { xs: 1, sm: 1.25, md: 1.5 },
                  borderBottom: index < sightings.length - 1 ? '1px solid' : 'none',
                  borderColor: 'divider',
                  alignItems: { xs: 'stretch', sm: 'center' },
                  // Subtle styling for the empty last row
                  bgcolor: isEmptyLastRow ? 'grey.50' : 'transparent',
                  transition: 'background-color 0.2s',
                }}
              >
                {/* Species Dropdown */}
                <Autocomplete
                  options={sortedSpecies}
                  groupBy={(option) => formatCategoryName(option.type)}
                  renderGroup={(params) => {
                    // Extract type from the formatted group name (e.g., "Butterfly" -> "butterfly")
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
                    // For the text field display
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
                                left: { xs: 8, sm: 14 },
                                pointerEvents: 'none',
                                fontSize: { xs: '16px', sm: '0.875rem' },
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
                            fontSize: { xs: '16px', sm: '0.875rem' },
                            padding: { xs: '6px 8px', sm: '8.5px 14px' },
                            // Hide the input text when we have a selection to show our custom formatted version
                            color: hasSelection && params.inputProps.value ? 'transparent' : 'inherit',
                          }
                        }}
                      />
                    );
                  }}
                  size="small"
                />

                {/* Count Input and Delete Button - grouped on mobile */}
                <Box
                  sx={{
                    display: 'contents', // On larger screens, act as if wrapper doesn't exist (grid children)
                    '@media (max-width: 600px)': {
                      display: 'flex',
                      flexDirection: 'row',
                      gap: 1,
                      alignItems: 'center',
                    }
                  }}
                >
                  {/* Count Input */}
                  <TextField
                  type="number"
                  value={sighting.count}
                  onChange={(e) =>
                    updateSighting(sighting.tempId, 'count', Math.max(1, parseInt(e.target.value) || 1))
                  }
                  onKeyDown={(e) => {
                    // Press Enter to add new row and focus next species field
                    if (e.key === 'Enter' && sighting.species_id !== null) {
                      e.preventDefault();
                      addSightingRow();
                      // Focus will naturally move to next row after state update
                    }
                    // Press Tab on last field to move to next row's species
                    if (e.key === 'Tab' && !e.shiftKey && isLastRow && sighting.species_id !== null) {
                      // Default Tab behavior will work, but ensure we have a new row
                      if (isEmpty) {
                        addSightingRow();
                      }
                    }
                  }}
                  size="small"
                  inputProps={{ min: 1 }}
                  placeholder="#"
                  sx={{
                    flex: { xs: 1, sm: 'unset' },
                    '& .MuiInputBase-input': {
                      fontSize: { xs: '16px', sm: '0.875rem' },
                      padding: { xs: '6px 8px', sm: '8.5px 14px' }
                    }
                  }}
                />

                  {/* Delete Button */}
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => removeSightingRow(sighting.tempId)}
                    disabled={sightings.length === 1}
                    sx={{
                      justifySelf: 'center',
                      opacity: isEmptyLastRow ? 0.3 : 1,
                      width: { xs: 32, sm: 36, md: 40 },
                      height: { xs: 32, sm: 36, md: 40 },
                    }}
                  >
                    <Delete sx={{ fontSize: { xs: 16, sm: 18, md: 20 } }} />
                  </IconButton>
                </Box>
              </Box>
            );
          })}
        </Box>
      ) : null}
    </>
  );
}
