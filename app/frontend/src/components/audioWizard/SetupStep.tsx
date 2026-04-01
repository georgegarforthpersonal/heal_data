import {
  Box,
  Typography,
  Paper,
  Stack,
  Button,
  Alert,
  Autocomplete,
  TextField,
} from '@mui/material';
import { ArrowForward } from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import type { AudioWizardState } from '../../hooks/useAudioWizard';

interface SetupStepProps {
  wizard: AudioWizardState;
}

export function SetupStep({ wizard }: SetupStepProps) {
  const {
    surveyTypes, selectedSurveyType, setSelectedSurveyType,
    devices, selectedDevice, setSelectedDevice,
    date, setDate,
    surveyors, selectedSurveyors, setSelectedSurveyors,
    canProceed, setActiveStep,
  } = wizard;

  return (
    <>
      <Paper sx={{ p: 3, mb: 3, boxShadow: 'none', border: '1px solid', borderColor: 'divider' }}>
        <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
          Survey Type
        </Typography>
        <Autocomplete
          options={surveyTypes}
          getOptionLabel={(option) => option.name}
          value={selectedSurveyType}
          onChange={(_, value) => setSelectedSurveyType(value)}
          renderInput={(params) => (
            <TextField {...params} label="Survey Type" required />
          )}
        />
      </Paper>

      {selectedSurveyType && (
        <Paper sx={{ p: 3, boxShadow: 'none', border: '1px solid', borderColor: 'divider' }}>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
            Survey Details
          </Typography>
          <Stack spacing={3}>
            <Autocomplete
              options={devices}
              getOptionLabel={(option) =>
                option.name ? `${option.name} (${option.device_id})` : option.device_id
              }
              value={selectedDevice}
              onChange={(_, value) => setSelectedDevice(value)}
              renderInput={(params) => (
                <TextField {...params} label="Device" required />
              )}
              noOptionsText="No audio recorder devices found. Add one in Admin > Devices."
            />
            {selectedDevice && !selectedDevice.latitude && (
              <Alert severity="warning">
                This device has no GPS coordinates set. Sightings will not have location data.
              </Alert>
            )}
            <DatePicker
              label="Date"
              value={date}
              onChange={setDate}
              slotProps={{ textField: { required: true, fullWidth: true } }}
            />
            <Autocomplete
              multiple
              options={surveyors}
              getOptionLabel={(option) => option.last_name ? `${option.first_name} ${option.last_name}` : option.first_name}
              value={selectedSurveyors}
              onChange={(_, value) => setSelectedSurveyors(value)}
              disableCloseOnSelect
              renderInput={(params) => (
                <TextField {...params} label="Surveyors" required />
              )}
            />
          </Stack>
          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              variant="contained"
              endIcon={<ArrowForward />}
              disabled={!canProceed(0)}
              onClick={() => setActiveStep(1)}
              sx={{ textTransform: 'none' }}
            >
              Next
            </Button>
          </Box>
        </Paper>
      )}
    </>
  );
}
