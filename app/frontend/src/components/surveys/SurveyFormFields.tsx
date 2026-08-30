import { useState } from 'react';
import { Stack, TextField, Autocomplete, Box, Dialog, InputAdornment } from '@mui/material';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { DateCalendar } from '@mui/x-date-pickers/DateCalendar';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import { Dayjs } from 'dayjs';
import type { Location, Surveyor } from '../../services/api';
import { locationDisplayName } from '../../services/api';
import SurveyorMultiSelect from './SurveyorMultiSelect';
import { useResponsive } from '../../hooks/useResponsive';

interface SurveyFormFieldsProps {
  // Form values
  date: Dayjs | null;
  locationId: number | null;
  selectedSurveyors: Surveyor[];
  notes: string;

  // Condition field values
  startTime?: Dayjs | null;
  endTime?: Dayjs | null;
  sunPercentage?: string;
  temperatureCelsius?: string;

  // Options
  locations: Location[];
  surveyors: Surveyor[];

  // Change handlers
  onDateChange: (newDate: Dayjs | null) => void;
  onLocationChange: (locationId: number | null) => void;
  onSurveyorsChange: (surveyors: Surveyor[]) => void;
  onNotesChange: (notes: string) => void;

  // Condition field change handlers
  onStartTimeChange?: (time: Dayjs | null) => void;
  onEndTimeChange?: (time: Dayjs | null) => void;
  onSunPercentageChange?: (value: string) => void;
  onTemperatureCelsiusChange?: (value: string) => void;

  // Validation errors
  validationErrors?: {
    date?: string;
    location?: string;
    surveyors?: string;
    endTime?: string;
  };

  // Visibility toggles
  hideLocation?: boolean;
  showStartEndTime?: boolean;
  showSunPercentage?: boolean;
  showTemperature?: boolean;
}

/**
 * SurveyFormFields - Reusable form fields for survey creation and editing
 *
 * Contains:
 * - Date picker
 * - Location dropdown
 * - Surveyors multi-select
 * - Start/end time pickers (conditional)
 * - Temperature and sun percentage inputs (conditional)
 * - Notes text area
 */
export function SurveyFormFields({
  date,
  locationId,
  selectedSurveyors,
  notes,
  startTime,
  endTime,
  sunPercentage,
  temperatureCelsius,
  locations,
  surveyors,
  onDateChange,
  onLocationChange,
  onSurveyorsChange,
  onNotesChange,
  onStartTimeChange,
  onEndTimeChange,
  onSunPercentageChange,
  onTemperatureCelsiusChange,
  validationErrors = {},
  hideLocation = false,
  showStartEndTime = false,
  showSunPercentage = false,
  showTemperature = false,
}: SurveyFormFieldsProps) {
  const [dateOpen, setDateOpen] = useState(false);
  const { isMobile } = useResponsive();

  // Time validation: end time must be after start time
  const timeError = hasTimeValidationError(startTime ?? null, endTime ?? null)
    ? 'End time must be after start time'
    : validationErrors.endTime;

  return (
    <Stack spacing={{ xs: 2, md: 3 }}>
      {/* Date entry (GEO-37). On mobile the segmented DD/MM/YYYY editor reads
          as editable text (its day section highlights on tap and again after
          picking), so the field there is a plain read-only tap target — the
          date is only ever chosen on the calendar: one tap opens the dialog,
          one tap on a day commits and closes it. Desktop keeps MUI's typable
          field with the popover calendar. */}
      {isMobile ? (
        <>
          <TextField
            label="Date *"
            value={date?.isValid() ? date.format('DD/MM/YYYY') : ''}
            fullWidth
            onClick={() => setDateOpen(true)}
            // A pure tap target never takes focus — a lingering focus ring
            // after picking would still suggest the text is editable.
            onMouseDown={(e) => e.preventDefault()}
            error={!!validationErrors.date}
            helperText={validationErrors.date}
            InputProps={{
              readOnly: true,
              endAdornment: (
                <InputAdornment position="end">
                  <CalendarTodayIcon fontSize="small" color="action" />
                </InputAdornment>
              ),
            }}
            sx={{
              '& .MuiInputBase-input': {
                fontSize: '16px',
                cursor: 'pointer',
                userSelect: 'none',
                caretColor: 'transparent',
              },
            }}
          />
          {/* disableRestoreFocus: closing must not hand focus back to the
              field, which would repaint the focus ring the field avoids. */}
          <Dialog open={dateOpen} onClose={() => setDateOpen(false)} disableRestoreFocus>
            <DateCalendar
              value={date}
              onChange={(newDate) => {
                onDateChange(newDate);
                setDateOpen(false);
              }}
            />
          </Dialog>
        </>
      ) : (
        <DatePicker
          label="Date *"
          value={date}
          onChange={onDateChange}
          open={dateOpen}
          onOpen={() => setDateOpen(true)}
          onClose={() => setDateOpen(false)}
          slotProps={{
            textField: {
              fullWidth: true,
              onClick: () => setDateOpen(true),
              error: !!validationErrors.date,
              helperText: validationErrors.date,
            },
          }}
        />
      )}

      {/* Location Dropdown - hidden when location is at sighting level */}
      {!hideLocation && (
        <Autocomplete
          options={locations}
          getOptionLabel={locationDisplayName}
          value={locations.find((l) => l.id === locationId) || null}
          onChange={(_, newValue) => onLocationChange(newValue?.id || null)}
          // A required single choice is a picker, not a text box: no clear ✕
          // and no select-on-focus text highlight (see the survey type field).
          disableClearable={locationId !== null}
          selectOnFocus={false}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Location *"
              error={!!validationErrors.location}
              helperText={validationErrors.location}
              // A handful of options needs no typing: read-only on mobile so
              // tapping opens the list without summoning the keyboard.
              inputProps={{ ...params.inputProps, readOnly: isMobile }}
              sx={{
                '& .MuiInputBase-input': {
                  fontSize: { xs: '16px', sm: '1rem' },
                  ...(isMobile
                    ? { cursor: 'pointer', userSelect: 'none', caretColor: 'transparent' }
                    : {}),
                }
              }}
            />
          )}
        />
      )}

      {/* Surveyors Multi-Select */}
      <SurveyorMultiSelect
        options={surveyors}
        value={selectedSurveyors}
        onChange={onSurveyorsChange}
        required
        error={!!validationErrors.surveyors}
        helperText={validationErrors.surveyors}
      />

      {/* Start/End Time Pickers */}
      {showStartEndTime && (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: { xs: 2, md: 3 } }}>
          <TimePicker
            label="Start Time"
            value={startTime ?? null}
            onChange={(val) => onStartTimeChange?.(val)}
            slotProps={{
              textField: {
                fullWidth: true,
                sx: {
                  '& .MuiInputBase-input': {
                    fontSize: { xs: '16px', sm: '1rem' },
                  }
                }
              },
            }}
          />
          <TimePicker
            label="End Time"
            value={endTime ?? null}
            onChange={(val) => onEndTimeChange?.(val)}
            slotProps={{
              textField: {
                fullWidth: true,
                error: !!timeError,
                helperText: timeError,
                sx: {
                  '& .MuiInputBase-input': {
                    fontSize: { xs: '16px', sm: '1rem' },
                  }
                }
              },
            }}
          />
        </Box>
      )}

      {/* Temperature and Sun Percentage */}
      {(showTemperature || showSunPercentage) && (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: showTemperature && showSunPercentage ? '1fr 1fr' : '1fr' }, gap: { xs: 2, md: 3 } }}>
          {showTemperature && (
            <TextField
              label="Temperature (°C)"
              type="number"
              value={temperatureCelsius ?? ''}
              onChange={(e) => onTemperatureCelsiusChange?.(e.target.value)}
              fullWidth
              inputProps={{ step: 0.5 }}
              sx={{
                '& .MuiInputBase-input': {
                  fontSize: { xs: '16px', sm: '1rem' },
                }
              }}
            />
          )}
          {showSunPercentage && (
            <TextField
              label="Sun %"
              type="number"
              value={sunPercentage ?? ''}
              onChange={(e) => onSunPercentageChange?.(e.target.value)}
              onBlur={() => {
                if (sunPercentage !== '' && sunPercentage != null) {
                  const clamped = Math.min(100, Math.max(0, Math.round(Number(sunPercentage))));
                  onSunPercentageChange?.(String(clamped));
                }
              }}
              fullWidth
              inputProps={{ min: 0, max: 100, step: 5 }}
              sx={{
                '& .MuiInputBase-input': {
                  fontSize: { xs: '16px', sm: '1rem' },
                }
              }}
            />
          )}
        </Box>
      )}

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

/**
 * Check if the time fields have a validation error (end time not after start time).
 * Exported for use in parent components to block form submission.
 */
export function hasTimeValidationError(startTime: Dayjs | null, endTime: Dayjs | null): boolean {
  if (startTime && endTime && startTime.isValid() && endTime.isValid()) {
    return endTime.isBefore(startTime) || endTime.isSame(startTime);
  }
  return false;
}
