/**
 * Mobile survey metadata as a row of chips instead of a form.
 *
 * Each chip is a statement about the survey — "Today", "George", "Meadow" —
 * that opens a bottom sheet to change. Unset required chips render amber so
 * the only things that ever ask for attention are the ones the app truly
 * can't answer. Nothing here defaults values; the chips only *display* the
 * page's existing state and edit it through the same setters the desktop
 * form uses.
 */

import { useState } from 'react';
import {
  Box,
  Button,
  Checkbox,
  Chip,
  Drawer,
  FormControlLabel,
  Radio,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';
import TuneIcon from '@mui/icons-material/Tune';
import StickyNote2OutlinedIcon from '@mui/icons-material/StickyNote2Outlined';
import { DateCalendar } from '@mui/x-date-pickers/DateCalendar';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import dayjs, { Dayjs } from 'dayjs';
import type { Location, Surveyor } from '../../services/api';
import { locationDisplayName } from '../../services/api';

type SheetKind = 'date' | 'surveyors' | 'location' | 'conditions' | 'note' | null;

interface SurveyContextChipsProps {
  date: Dayjs | null;
  onDateChange: (d: Dayjs | null) => void;
  surveyors: Surveyor[];
  selectedSurveyors: Surveyor[];
  onSurveyorsChange: (s: Surveyor[]) => void;
  locations: Location[];
  locationId: number | null;
  onLocationChange: (id: number | null) => void;
  hideLocation: boolean;
  notes: string;
  onNotesChange: (n: string) => void;
  startTime: Dayjs | null;
  endTime: Dayjs | null;
  sunPercentage: string;
  temperatureCelsius: string;
  onStartTimeChange: (t: Dayjs | null) => void;
  onEndTimeChange: (t: Dayjs | null) => void;
  onSunPercentageChange: (v: string) => void;
  onTemperatureCelsiusChange: (v: string) => void;
  showStartEndTime: boolean;
  showSunPercentage: boolean;
  showTemperature: boolean;
  validationErrors: { date?: string; surveyors?: string; location?: string; endTime?: string };
}

/** Chip label for the chosen date: "Today", "Yesterday", else "Mon 4 Aug". */
function dateLabel(date: Dayjs): string {
  if (date.isSame(dayjs(), 'day')) return 'Today';
  if (date.isSame(dayjs().subtract(1, 'day'), 'day')) return 'Yesterday';
  return date.format('ddd D MMM');
}

function surveyorName(s: Surveyor): string {
  return [s.first_name, s.last_name].filter(Boolean).join(' ');
}

export function SurveyContextChips(props: SurveyContextChipsProps) {
  const [sheet, setSheet] = useState<SheetKind>(null);
  const close = () => setSheet(null);

  const showConditions = props.showStartEndTime || props.showSunPercentage || props.showTemperature;
  const conditionsCount =
    (props.startTime ? 1 : 0) +
    (props.endTime ? 1 : 0) +
    (props.sunPercentage !== '' ? 1 : 0) +
    (props.temperatureCelsius !== '' ? 1 : 0);

  const surveyorLabel =
    props.selectedSurveyors.length === 0
      ? 'Add surveyors'
      : props.selectedSurveyors.length === 1
        ? props.selectedSurveyors[0].first_name
        : `${props.selectedSurveyors[0].first_name} +${props.selectedSurveyors.length - 1}`;

  const location = props.locations.find((l) => l.id === props.locationId) ?? null;

  // Unset-required chips are amber; a failed save turns them into errors.
  const askSx = (hasError: boolean) => ({
    bgcolor: hasError ? 'error.50' : 'warning.50',
    color: hasError ? 'error.dark' : 'warning.dark',
    borderColor: hasError ? 'error.main' : 'warning.main',
    fontWeight: 600,
  });
  const setSx = { bgcolor: 'success.50', color: 'success.dark', borderColor: 'success.light', fontWeight: 600 };
  const quietSx = { color: 'text.secondary', fontWeight: 600 };

  return (
    <>
      <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: 'wrap', mb: 1.5 }}>
        <Chip
          icon={<CalendarTodayIcon sx={{ fontSize: 15 }} />}
          label={props.date ? dateLabel(props.date) : 'Set date'}
          variant="outlined"
          onClick={() => setSheet('date')}
          sx={props.date ? setSx : askSx(!!props.validationErrors.date)}
        />
        <Chip
          icon={<PersonOutlineIcon sx={{ fontSize: 16 }} />}
          label={surveyorLabel}
          variant="outlined"
          onClick={() => setSheet('surveyors')}
          sx={props.selectedSurveyors.length > 0 ? setSx : askSx(!!props.validationErrors.surveyors)}
        />
        {!props.hideLocation && (
          <Chip
            icon={<PlaceOutlinedIcon sx={{ fontSize: 16 }} />}
            label={location ? locationDisplayName(location) : 'Set location'}
            variant="outlined"
            onClick={() => setSheet('location')}
            sx={location ? setSx : askSx(!!props.validationErrors.location)}
          />
        )}
        {showConditions && (
          <Chip
            icon={<TuneIcon sx={{ fontSize: 16 }} />}
            label={conditionsCount > 0 ? `Conditions · ${conditionsCount}` : 'Conditions'}
            variant="outlined"
            onClick={() => setSheet('conditions')}
            sx={conditionsCount > 0 ? setSx : quietSx}
          />
        )}
        <Chip
          icon={<StickyNote2OutlinedIcon sx={{ fontSize: 16 }} />}
          label={props.notes.trim() !== '' ? 'Note ✓' : 'Note'}
          variant="outlined"
          onClick={() => setSheet('note')}
          sx={props.notes.trim() !== '' ? setSx : quietSx}
        />
      </Stack>

      <Drawer
        anchor="bottom"
        open={sheet !== null}
        onClose={close}
        slotProps={{
          paper: {
            sx: {
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              px: 2,
              pt: 1,
              pb: 'calc(16px + env(safe-area-inset-bottom))',
              maxHeight: '80dvh',
            },
          },
        }}
      >
        <Box sx={{ width: 36, height: 4, borderRadius: 2, bgcolor: 'divider', mx: 'auto', mb: 1 }} />

        {sheet === 'date' && (
          <>
            <SheetTitle>Survey date</SheetTitle>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', px: 0.5 }}>
              The date decides which scheduled survey this recording counts towards.
            </Typography>
            <DateCalendar
              value={props.date}
              onChange={(d) => {
                props.onDateChange(d);
                close();
              }}
            />
            <Button
              fullWidth
              variant="outlined"
              onClick={() => {
                props.onDateChange(dayjs());
                close();
              }}
              sx={{ textTransform: 'none', fontWeight: 600 }}
            >
              Today
            </Button>
          </>
        )}

        {sheet === 'surveyors' && (
          <>
            <SheetTitle>Surveyors</SheetTitle>
            <Box sx={{ overflowY: 'auto' }}>
              {props.surveyors.map((s) => {
                const checked = props.selectedSurveyors.some((sel) => sel.id === s.id);
                return (
                  <FormControlLabel
                    key={s.id}
                    sx={{ display: 'flex', mx: 0, py: 0.25 }}
                    control={
                      <Checkbox
                        checked={checked}
                        onChange={(_, next) =>
                          props.onSurveyorsChange(
                            next
                              ? [...props.selectedSurveyors, s]
                              : props.selectedSurveyors.filter((sel) => sel.id !== s.id)
                          )
                        }
                      />
                    }
                    label={surveyorName(s)}
                  />
                );
              })}
            </Box>
            <DoneButton onClick={close} />
          </>
        )}

        {sheet === 'location' && (
          <>
            <SheetTitle>Location</SheetTitle>
            <Box sx={{ overflowY: 'auto' }}>
              {props.locations.map((l) => (
                <FormControlLabel
                  key={l.id}
                  sx={{ display: 'flex', mx: 0, py: 0.25 }}
                  control={
                    <Radio
                      checked={props.locationId === l.id}
                      onChange={() => {
                        props.onLocationChange(l.id);
                        close();
                      }}
                    />
                  }
                  label={locationDisplayName(l)}
                />
              ))}
            </Box>
          </>
        )}

        {sheet === 'conditions' && (
          <>
            <SheetTitle>Conditions</SheetTitle>
            <Stack spacing={2} sx={{ mt: 1 }}>
              {props.showStartEndTime && (
                <Stack direction="row" spacing={1.5}>
                  <TimePicker
                    label="Start time"
                    value={props.startTime}
                    onChange={props.onStartTimeChange}
                    slotProps={{ textField: { fullWidth: true, size: 'small' } }}
                  />
                  <TimePicker
                    label="End time"
                    value={props.endTime}
                    onChange={props.onEndTimeChange}
                    slotProps={{
                      textField: {
                        fullWidth: true,
                        size: 'small',
                        error: !!props.validationErrors.endTime,
                        helperText: props.validationErrors.endTime,
                      },
                    }}
                  />
                </Stack>
              )}
              {props.showSunPercentage && (
                <TextField
                  label="Sun %"
                  type="number"
                  size="small"
                  value={props.sunPercentage}
                  onChange={(e) => props.onSunPercentageChange(e.target.value)}
                  inputProps={{ min: 0, max: 100 }}
                  sx={{ '& .MuiInputBase-input': { fontSize: '16px' } }}
                />
              )}
              {props.showTemperature && (
                <TextField
                  label="Temperature °C"
                  type="number"
                  size="small"
                  value={props.temperatureCelsius}
                  onChange={(e) => props.onTemperatureCelsiusChange(e.target.value)}
                  sx={{ '& .MuiInputBase-input': { fontSize: '16px' } }}
                />
              )}
            </Stack>
            <DoneButton onClick={close} />
          </>
        )}

        {sheet === 'note' && (
          <>
            <SheetTitle>Survey note</SheetTitle>
            <TextField
              multiline
              minRows={3}
              fullWidth
              autoFocus
              placeholder="Anything worth remembering about this visit…"
              value={props.notes}
              onChange={(e) => props.onNotesChange(e.target.value)}
              sx={{ mt: 1, '& .MuiInputBase-input': { fontSize: '16px' } }}
            />
            <DoneButton onClick={close} />
          </>
        )}
      </Drawer>
    </>
  );
}

function SheetTitle({ children }: { children: React.ReactNode }) {
  return (
    <Typography variant="subtitle1" sx={{ fontWeight: 700, px: 0.5, mb: 0.5 }}>
      {children}
    </Typography>
  );
}

function DoneButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      fullWidth
      variant="contained"
      onClick={onClick}
      sx={{ mt: 2, textTransform: 'none', fontWeight: 600, boxShadow: 'none' }}
    >
      Done
    </Button>
  );
}
