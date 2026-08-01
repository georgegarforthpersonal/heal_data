/**
 * A number field with − and + either side, for counts that are usually
 * nudged but occasionally typed.
 *
 * NN/g's stepper guidance calls for the value to stay directly typable —
 * a pure tap control is nine taps to get from 1 to 10, and an adult dragonfly
 * count can be 40. So the middle is a real input with a numeric keypad, and
 * the buttons are the fast path.
 */

import { Box, IconButton, InputBase, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';

interface NumberStepperProps {
  label: string;
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  helperText?: string;
  disabled?: boolean;
  autoFocus?: boolean;
}

/** Matches the tally cards, and clears Material's 48dp touch-target floor. */
const CONTROL_HEIGHT = 56;

export default function NumberStepper({
  label,
  value,
  onChange,
  min = 0,
  max = 9999,
  helperText,
  disabled = false,
  autoFocus = false,
}: NumberStepperProps) {
  const clamp = (next: number) => Math.min(Math.max(next, min), max);

  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
        {label}
      </Typography>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'stretch',
          height: CONTROL_HEIGHT,
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: '10px',
          overflow: 'hidden',
        }}
      >
        <IconButton
          onClick={() => onChange(clamp(value - 1))}
          disabled={disabled || value <= min}
          aria-label={`Subtract one from ${label}`}
          sx={{ width: 56, borderRadius: 0, flexShrink: 0 }}
        >
          <RemoveIcon />
        </IconButton>
        <InputBase
          value={value || ''}
          onChange={(e) => {
            const raw = e.target.value.trim();
            if (raw === '') {
              onChange(min);
              return;
            }
            // type=text + inputmode: type=number drops letters silently,
            // ignores maxlength and changes on scroll wheel.
            if (!/^\d{1,4}$/.test(raw)) return;
            onChange(clamp(parseInt(raw, 10)));
          }}
          disabled={disabled}
          autoFocus={autoFocus}
          inputProps={{
            inputMode: 'numeric',
            pattern: '[0-9]*',
            enterKeyHint: 'done',
            'aria-label': label,
            style: { textAlign: 'center', fontSize: '1.25rem', fontWeight: 700 },
          }}
          sx={{
            flex: 1,
            minWidth: 0,
            borderLeft: '1px solid',
            borderRight: '1px solid',
            borderColor: 'divider',
            px: 1,
          }}
        />
        <IconButton
          onClick={() => onChange(clamp(value + 1))}
          disabled={disabled || value >= max}
          aria-label={`Add one to ${label}`}
          sx={{ width: 56, borderRadius: 0, flexShrink: 0 }}
        >
          <AddIcon />
        </IconButton>
      </Box>
      {helperText && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
          {helperText}
        </Typography>
      )}
    </Box>
  );
}
