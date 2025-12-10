import { Dialog, DialogTitle, DialogContent, DialogActions, Button, IconButton, Typography, Box } from '@mui/material';
import { Close } from '@mui/icons-material';
import LocationMapPicker from './LocationMapPicker';
import { useState, useEffect } from 'react';

interface LocationModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (lat: number | null, lng: number | null) => void;
  initialLatitude?: number | null;
  initialLongitude?: number | null;
  speciesName?: string;
}

export function LocationModal({
  open,
  onClose,
  onSave,
  initialLatitude,
  initialLongitude,
  speciesName,
}: LocationModalProps) {
  const [latitude, setLatitude] = useState<number | null>(initialLatitude || null);
  const [longitude, setLongitude] = useState<number | null>(initialLongitude || null);

  // Update local state when initial values change
  useEffect(() => {
    if (open) {
      setLatitude(initialLatitude || null);
      setLongitude(initialLongitude || null);
    }
  }, [open, initialLatitude, initialLongitude]);

  const handleLocationChange = (lat: number | null, lng: number | null) => {
    setLatitude(lat);
    setLongitude(lng);
  };

  const handleSave = () => {
    onSave(latitude, longitude);
    onClose();
  };

  const handleClear = () => {
    setLatitude(null);
    setLongitude(null);
    onSave(null, null);
    onClose();
  };

  const handleCancel = () => {
    // Reset to initial values
    setLatitude(initialLatitude || null);
    setLongitude(initialLongitude || null);
    onClose();
  };

  const hasLocation = latitude !== null && longitude !== null;

  return (
    <Dialog
      open={open}
      onClose={handleCancel}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          minHeight: '600px',
        }
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid',
          borderColor: 'divider',
          pb: 2,
        }}
      >
        <Box>
          <Typography variant="h6" fontWeight={600}>
            Set Sighting Location
          </Typography>
          {speciesName && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {speciesName}
            </Typography>
          )}
        </Box>
        <IconButton onClick={handleCancel} edge="end">
          <Close />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 3, pb: 2 }}>
        <LocationMapPicker
          latitude={latitude || undefined}
          longitude={longitude || undefined}
          onChange={handleLocationChange}
          label="Sighting Location"
          helperText="Click on the map to mark where you saw this species, or use your current location"
        />
      </DialogContent>

      <DialogActions
        sx={{
          borderTop: '1px solid',
          borderColor: 'divider',
          p: 2,
          gap: 1,
          justifyContent: 'space-between',
        }}
      >
        <Box>
          {hasLocation && (
            <Button
              onClick={handleClear}
              color="error"
              variant="outlined"
              sx={{ textTransform: 'none', fontWeight: 600 }}
            >
              Clear Location
            </Button>
          )}
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            onClick={handleCancel}
            variant="outlined"
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            variant="contained"
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            Save Location
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
}
