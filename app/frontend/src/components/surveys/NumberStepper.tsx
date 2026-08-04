/**
 * A number field with − and + either side, for counts that are usually
 * nudged but occasionally typed.
 *
 * NN/g's stepper guidance calls for the value to stay directly typable —
 * a pure tap control is nine taps to get from 1 to 10, and an adult dragonfly
 * count can be 40. So the middle is a real input with a numeric keypad, and
 * the buttons are the fast path.
 *
 * `size="small"` + `labelPlacement="start"` is the row variant used for the
 * BDS stage counts: label on the left, a compact stepper on the right — one
 * control language for every count on the form, with size carrying hierarchy.
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
  /** 'medium' is the primary-field control; 'small' the compact row variant. */
  size?: 'medium' | 'small';
  /** 'top' stacks the label above; 'start' puts it beside, stepper right. */
  labelPlacement?: 'top' | 'start';
}

/** Clears Material's 48dp touch-target floor at medium; small stays tappable. */
const SIZES = {
  medium: { height: 56, button: 56, font: '1.25rem', inputWidth: undefined },
  small: { height: 44, button: 44, font: '1rem', inputWidth: 52 },
} as const;

export default function NumberStepper({
  label,
  value,
  onChange,
  min = 0,
  max = 9999,
  helperText,
  disabled = false,
  autoFocus = false,
  size = 'medium',
  labelPlacement = 'top',
}: NumberStepperProps) {
  const clamp = (next: number) => Math.min(Math.max(next, min), max);
  const dims = SIZES[size];

  const control = (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'stretch',
        height: dims.height,
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1.5,
        overflow: 'hidden',
        flexShrink: 0,
        ...(labelPlacement === 'top' ? {} : { width: 'auto' }),
      }}
    >
      <IconButton
        onClick={() => onChange(clamp(value - 1))}
        disabled={disabled || value <= min}
        aria-label={`Subtract one from ${label}`}
        sx={{ width: dims.button, borderRadius: 0, flexShrink: 0 }}
      >
        <RemoveIcon fontSize={size === 'small' ? 'small' : 'medium'} />
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
        // The input holds '' at zero so typing can start clean; the
        // placeholder paints the resting 0.
        placeholder="0"
        inputProps={{
          inputMode: 'numeric',
          pattern: '[0-9]*',
          enterKeyHint: 'done',
          'aria-label': label,
          style: {
            textAlign: 'center',
            fontSize: dims.font,
            fontWeight: 700,
          },
        }}
        sx={{
          // Small is a fixed-width row control; medium stretches to its box.
          ...(dims.inputWidth ? { flex: 'none', width: dims.inputWidth } : { flex: 1, minWidth: 0 }),
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
        sx={{ width: dims.button, borderRadius: 0, flexShrink: 0 }}
      >
        <AddIcon fontSize={size === 'small' ? 'small' : 'medium'} />
      </IconButton>
    </Box>
  );

  if (labelPlacement === 'start') {
    return (
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Typography
            variant="body2"
            sx={{ flex: 1, minWidth: 0, fontWeight: 600, color: 'text.primary' }}
          >
            {label}
          </Typography>
          {control}
        </Box>
        {helperText && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
            {helperText}
          </Typography>
        )}
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
        {label}
      </Typography>
      {control}
      {helperText && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
          {helperText}
        </Typography>
      )}
    </Box>
  );
}
