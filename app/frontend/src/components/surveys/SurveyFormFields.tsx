import { useState } from 'react';
import { Stack, TextField, Autocomplete, Chip } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { Dayjs } from 'dayjs';
import type { Location, Surveyor } from '../../services/api';

interface SurveyFormFieldsProps {
  // Form values
  date: Dayjs | null;
  locationId: number | null;
  selectedSurveyors: Surveyor[];
  notes: string;

  // Options
  locations: Location[];
  surveyors: Surveyor[];

  // Change handlers
  onDateChange: (newDate: Dayjs | null) => void;
  onLocationChange: (locationId: number | null) => void;
  onSurveyorsChange: (surveyors: Surveyor[]) => void;
  onNotesChange: (notes: string) => void;

  // Validation errors
  validationErrors?: {
    date?: string;
    location?: string;
    surveyors?: string;
  };

  // Hide location when location is at sighting level
  hideLocation?: boolean;
}

/**
 * SurveyFormFields - Reusable form fields for survey creation and editing
 *
 * Contains:
 * - Date picker
 * - Location dropdown
 * - Surveyors multi-select
 * - Notes text area
 */
export function SurveyFormFields({
  date,
  locationId,
  selectedSurveyors,
  notes,
  locations,
  surveyors,
  onDateChange,
  onLocationChange,
  onSurveyorsChange,
  onNotesChange,
  validationErrors = {},
  hideLocation = false,
}: SurveyFormFieldsProps) {
  const [surveyorsOpen, setSurveyorsOpen] = useState(false);

  return (
    <Stack spacing={{ xs: 2, md: 3 }}>
      {/* Date Picker */}
      <DatePicker
        label="Date *"
        value={date}
        onChange={onDateChange}
        slotProps={{
          textField: {
            fullWidth: true,
            error: !!validationErrors.date,
            helperText: validationErrors.date,
            sx: {
              '& .MuiInputBase-input': {
                fontSize: { xs: '16px', sm: '1rem' },
              }
            }
          },
        }}
      />

      {/* Location Dropdown - hidden when location is at sighting level */}
      {!hideLocation && (
        <Autocomplete
          options={locations}
          getOptionLabel={(option) => option.name}
          value={locations.find((l) => l.id === locationId) || null}
          onChange={(_, newValue) => onLocationChange(newValue?.id || null)}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Location *"
              error={!!validationErrors.location}
              helperText={validationErrors.location}
              sx={{
                '& .MuiInputBase-input': {
                  fontSize: { xs: '16px', sm: '1rem' },
                }
              }}
            />
          )}
        />
      )}

      {/* Surveyors Multi-Select */}
      <Autocomplete
        multiple
        options={surveyors}
        getOptionLabel={(option) => option.last_name ? `${option.first_name} ${option.last_name}` : option.first_name}
        value={selectedSurveyors}
        open={surveyorsOpen}
        onOpen={() => setSurveyorsOpen(true)}
        onClose={(_event, reason) => {
          // Only close when clicking outside or pressing escape, not when selecting
          if (reason !== 'selectOption') {
            setSurveyorsOpen(false);
          }
        }}
        onChange={(_, newValue) => onSurveyorsChange(newValue)}
        disableCloseOnSelect
        renderInput={(params) => (
          <TextField
            {...params}
            label="Surveyors *"
            error={!!validationErrors.surveyors}
            helperText={validationErrors.surveyors}
            sx={{
              '& .MuiInputBase-input': {
                fontSize: { xs: '16px', sm: '1rem' },
              }
            }}
          />
        )}
        renderTags={(value, getTagProps) =>
          value.map((option, index) => (
            <Chip
              label={option.last_name ? `${option.first_name} ${option.last_name}` : option.first_name}
              {...getTagProps({ index })}
              size="small"
              key={option.id}
            />
          ))
        }
      />

      {/* Notes */}
      <TextField
        label="Notes (Optional)"
        multiline
        rows={3}
        value={notes}
        onChange={(e) => onNotesChange(e.target.value)}
        placeholder="Add any additional notes about this survey..."
        fullWidth
        sx={{
          '& .MuiInputBase-input': {
            fontSize: { xs: '16px', sm: '1rem' },
          }
        }}
      />
    </Stack>
  );
}
