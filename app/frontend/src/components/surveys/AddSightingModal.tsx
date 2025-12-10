import { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Autocomplete, Stack, Box, Typography, IconButton } from '@mui/material';
import { Close } from '@mui/icons-material';
import type { Species } from '../../services/api';
import { ButterflyIcon, BirdIcon, MushroomIcon, SpiderIcon, BatIcon, MammalIcon, ReptileIcon, AmphibianIcon, MothIcon, BugIcon, LeafIcon, BeeIcon, BeetleIcon, FlyIcon, GrasshopperIcon, DragonflyIcon, EarwigIcon } from '../icons/WildlifeIcons';
import LocationMapPicker from './LocationMapPicker';

export interface SightingData {
  species_id: number | null;
  count: number;
  latitude?: number | null;
  longitude?: number | null;
}

interface AddSightingModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (sighting: SightingData) => void;
  species: Species[];
  initialData?: SightingData;
  mode: 'add' | 'edit';
}

/**
 * AddSightingModal - Full-screen modal for adding/editing individual sightings
 *
 * Features:
 * - Full-screen on mobile for maximum autocomplete space
 * - Grouped species list with icons
 * - Simple two-field interface: species + count
 */
export function AddSightingModal({
  open,
  onClose,
  onSave,
  species,
  initialData,
  mode,
}: AddSightingModalProps) {
  const [selectedSpeciesId, setSelectedSpeciesId] = useState<number | null>(initialData?.species_id || null);
  const [count, setCount] = useState<number>(initialData?.count || 1);
  const [latitude, setLatitude] = useState<number | null>(initialData?.latitude || null);
  const [longitude, setLongitude] = useState<number | null>(initialData?.longitude || null);

  // Update local state when initialData changes (for edit mode)
  useEffect(() => {
    if (initialData) {
      setSelectedSpeciesId(initialData.species_id);
      setCount(initialData.count);
      setLatitude(initialData.latitude || null);
      setLongitude(initialData.longitude || null);
    } else {
      setSelectedSpeciesId(null);
      setCount(1);
      setLatitude(null);
      setLongitude(null);
    }
  }, [initialData, open]);

  // Sort species by type first, then by name within each type
  const sortedSpecies = [...species].sort((a, b) => {
    if (a.type !== b.type) {
      return a.type.localeCompare(b.type);
    }
    const nameA = a.name || a.scientific_name || '';
    const nameB = b.name || b.scientific_name || '';
    return nameA.localeCompare(nameB);
  });

  // Format category name for display
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
        return EarwigIcon;
    }
  };

  const handleSave = () => {
    if (selectedSpeciesId) {
      onSave({
        species_id: selectedSpeciesId,
        count: Math.max(1, count),
        latitude: latitude,
        longitude: longitude,
      });
      // Reset for next entry
      setSelectedSpeciesId(null);
      setCount(1);
      setLatitude(null);
      setLongitude(null);
      onClose();
    }
  };

  const handleCancel = () => {
    // Reset form
    setSelectedSpeciesId(initialData?.species_id || null);
    setCount(initialData?.count || 1);
    setLatitude(initialData?.latitude || null);
    setLongitude(initialData?.longitude || null);
    onClose();
  };

  const handleLocationChange = (lat: number | null, lng: number | null) => {
    setLatitude(lat);
    setLongitude(lng);
  };

  const selectedSpecies = species.find(s => s.id === selectedSpeciesId);
  const canSave = selectedSpeciesId !== null && count > 0;

  return (
    <Dialog
      open={open}
      onClose={handleCancel}
      fullScreen
      sx={{
        '& .MuiDialog-paper': {
          bgcolor: 'background.default',
        }
      }}
    >
      {/* Header */}
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid',
          borderColor: 'divider',
          py: 2,
          mb: 2,
        }}
      >
        <Typography variant="h6" fontWeight={600}>
          {mode === 'add' ? 'Add Sighting' : 'Edit Sighting'}
        </Typography>
        <IconButton onClick={handleCancel} edge="end">
          <Close />
        </IconButton>
      </DialogTitle>

      {/* Content */}
      <DialogContent sx={{ pt: 4, pb: 3 }}>
        <Stack spacing={3}>
          {/* Species Autocomplete - Takes up most of the space */}
          <Box>
            <Autocomplete
              options={sortedSpecies}
              groupBy={(option) => formatCategoryName(option.type)}
              renderGroup={(params) => {
                const type = params.group.toLowerCase();
                const SpeciesIcon = getSpeciesIcon(type);

                return (
                  <li key={params.key}>
                    <Box sx={{ px: 2, py: 1.5, bgcolor: 'grey.50', borderBottom: '1px solid', borderColor: 'divider' }}>
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <SpeciesIcon sx={{ fontSize: '18px', color: 'text.secondary' }} />
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
              value={selectedSpecies || null}
              onChange={(_, newValue) => setSelectedSpeciesId(newValue?.id || null)}
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
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Species *"
                  placeholder="Start typing to search..."
                  autoFocus
                  sx={{
                    '& .MuiInputBase-input': {
                      fontSize: '16px',
                    }
                  }}
                />
              )}
              ListboxProps={{
                sx: {
                  maxHeight: { xs: '50vh', sm: '400px' },
                  '& .MuiAutocomplete-option': {
                    py: 1.5,
                    px: 2,
                    fontSize: '16px',
                  }
                }
              }}
            />
          </Box>

          {/* Count Input */}
          <TextField
            label="Count *"
            type="number"
            value={count}
            onChange={(e) => setCount(Math.max(1, parseInt(e.target.value) || 1))}
            inputProps={{ min: 1 }}
            fullWidth
            sx={{
              '& .MuiInputBase-input': {
                fontSize: '16px',
              }
            }}
          />

          {/* Location Map Picker */}
          <Box>
            <LocationMapPicker
              latitude={latitude || undefined}
              longitude={longitude || undefined}
              onChange={handleLocationChange}
              label="Sighting Location (Optional)"
              helperText="Mark where you saw this species on the map, or use your current location"
            />
          </Box>
        </Stack>
      </DialogContent>

      {/* Actions */}
      <DialogActions
        sx={{
          borderTop: '1px solid',
          borderColor: 'divider',
          p: 2,
          gap: 1,
        }}
      >
        <Button
          onClick={handleCancel}
          variant="outlined"
          fullWidth
          sx={{
            textTransform: 'none',
            fontWeight: 600,
            fontSize: '16px',
          }}
        >
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          fullWidth
          disabled={!canSave}
          sx={{
            textTransform: 'none',
            fontWeight: 600,
            fontSize: '16px',
          }}
        >
          {mode === 'add' ? 'Add' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
