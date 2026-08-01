/**
 * Life stage & behaviour counts (BDS Odonata recording form).
 *
 * Tally mode is the default: each category is one large tap-to-increment
 * target, because five of the six BDS columns have a modal value of 0 and
 * small deviations — the case NN/g's stepper guidance says suits steppers, and
 * the pattern eBird and BirdTrack both converged on. Typing six numbers meant
 * six focus/keyboard/dismiss cycles per species, with the keyboard covering
 * the fields you hadn't filled in yet.
 *
 * Tap-to-increment alone is slow for large values, so "Type" flips the whole
 * panel to numeric inputs rather than hiding that escape hatch behind a
 * long-press (long-press on mobile web fights text selection and the context
 * menu, and is undiscoverable).
 *
 * Not recorded renders as an em dash and zero renders as 0 — they mean
 * different things (no visit data vs. a real absence) and conflating them
 * quietly degrades the dataset.
 */

import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  ButtonBase,
  Chip,
  IconButton,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import RemoveIcon from '@mui/icons-material/Remove';
import TouchAppIcon from '@mui/icons-material/TouchApp';
import KeyboardIcon from '@mui/icons-material/Keyboard';

import {
  MAX_STAGE_COUNT,
  STAGE_COUNT_FIELDS,
  STAGE_COUNT_KEYS,
  deriveBreedingTier,
  stageCountWarnings,
  type StageCountKey,
  type StageCounts,
} from '../../config/stageCounts';
import { notionColors } from '../../theme';
import { tick } from '../../utils/haptics';
import { CATEGORY_COLORS } from './breedingConstants';

/**
 * Comfortably above Material's 48dp floor and Hoober's 46px bottom-of-screen
 * figure: this gets tapped one-handed, outdoors, sometimes with gloves.
 */
const CHIP_MIN_HEIGHT = 64;

interface StageCountsFieldsProps {
  value: StageCounts;
  onChange: (key: StageCountKey, next: number | null) => void;
  /** The sighting's Count field, used to derive the tier and cross-check totals. */
  adultTotal?: number | null;
  disabled?: boolean;
}

/** Not recorded reads as a state, not a gap. */
const NOT_RECORDED = '—';

export default function StageCountsFields({
  value,
  onChange,
  adultTotal,
  disabled = false,
}: StageCountsFieldsProps) {
  const [mode, setMode] = useState<'tally' | 'type'>('tally');
  const tier = deriveBreedingTier(value, adultTotal);
  const warnings = stageCountWarnings(value, adultTotal);

  const increment = (key: StageCountKey) => {
    const current = value[key];
    const next = Math.min((typeof current === 'number' ? current : 0) + 1, MAX_STAGE_COUNT);
    onChange(key, next);
    tick();
  };

  // Steps back down to zero, then to not-recorded, so every value including
  // the "looked and saw none" zero is reachable and reversible by tapping.
  const decrement = (key: StageCountKey) => {
    const current = value[key];
    if (typeof current !== 'number') return;
    onChange(key, current <= 0 ? null : current - 1);
    tick();
  };

  /** Set every unrecorded category to zero: "I checked, there were none." */
  const markRestNoneSeen = () => {
    for (const key of STAGE_COUNT_KEYS) {
      if (typeof value[key] !== 'number') onChange(key, 0);
    }
  };

  const anyRecorded = STAGE_COUNT_KEYS.some((key) => typeof value[key] === 'number');
  const allRecorded = STAGE_COUNT_KEYS.every((key) => typeof value[key] === 'number');

  return (
    <Box>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ mb: 0.5, gap: 1, flexWrap: 'wrap' }}
      >
        <Typography variant="subtitle2" sx={{ minWidth: 0 }}>
          Life stage &amp; behaviour
        </Typography>
        <ToggleButtonGroup
          value={mode}
          exclusive
          size="small"
          onChange={(_, next) => next && setMode(next)}
          disabled={disabled}
          sx={{ flexShrink: 0 }}
        >
          <ToggleButton value="tally" sx={{ gap: 0.5, textTransform: 'none' }}>
            <TouchAppIcon fontSize="small" />
            Tap
          </ToggleButton>
          <ToggleButton value="type" sx={{ gap: 0.5, textTransform: 'none' }}>
            <KeyboardIcon fontSize="small" />
            Type
          </ToggleButton>
        </ToggleButtonGroup>
      </Stack>

      <Typography variant="caption" color="text.secondary" sx={{ mb: 1.5, display: 'block' }}>
        {mode === 'tally'
          ? 'British Dragonfly Society columns. Tap a card to count up; − steps back down, then to not recorded.'
          : 'British Dragonfly Society columns. Leave blank if not recorded; enter 0 if you looked and saw none.'}
      </Typography>

      {mode === 'tally' ? (
        <Stack spacing={1}>
          {STAGE_COUNT_FIELDS.map((field) => {
            const current = value[field.key];
            const isSet = typeof current === 'number';
            const isCounting = isSet && current > 0;
            const palette = notionColors[field.color];

            return (
              <Stack
                key={field.key}
                direction="row"
                spacing={1}
                alignItems="stretch"
                sx={{ width: '100%' }}
              >
                <Tooltip title={field.helper ?? ''} enterDelay={700}>
                  <ButtonBase
                    onClick={() => increment(field.key)}
                    disabled={disabled}
                    aria-label={`${field.label}: ${isSet ? current : 'not recorded'}. Tap to add one.`}
                    sx={{
                      flex: 1,
                      // Without this a long label sets a min-content floor and
                      // pushes the − button off the edge on narrow screens.
                      minWidth: 0,
                      minHeight: CHIP_MIN_HEIGHT,
                      px: 2,
                      py: 1,
                      borderRadius: 1.5,
                      border: '2px solid',
                      // Border carries the category colour so the cue clears
                      // 3:1 against the page even when the fill is pale.
                      borderColor: isCounting ? palette.text : 'divider',
                      bgcolor: isCounting ? palette.background : 'transparent',
                      justifyContent: 'space-between',
                      textAlign: 'left',
                      transition: 'background-color .15s, border-color .15s',
                      '&:active': { transform: 'scale(0.99)' },
                    }}
                  >
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: 600,
                        color: isCounting ? palette.text : 'text.primary',
                        minWidth: 0,
                        pr: 1,
                      }}
                    >
                      {field.label}
                    </Typography>
                    <Typography
                      component="span"
                      sx={{
                        fontSize: '1.5rem',
                        fontWeight: 700,
                        lineHeight: 1,
                        minWidth: 40,
                        textAlign: 'right',
                        color: isCounting
                          ? palette.text
                          : isSet
                            ? 'text.primary'
                            : 'text.disabled',
                      }}
                    >
                      {isSet ? current : NOT_RECORDED}
                    </Typography>
                  </ButtonBase>
                </Tooltip>
                <IconButton
                  onClick={() => decrement(field.key)}
                  disabled={disabled || !isSet}
                  aria-label={`Subtract one from ${field.label}`}
                  sx={{
                    width: 48,
                    flexShrink: 0,
                    alignSelf: 'stretch',
                    // Rounded rect, not the default circle: a stretched
                    // circular IconButton renders as an ellipse next to the card.
                    borderRadius: 1.5,
                    border: '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  <RemoveIcon fontSize="small" />
                </IconButton>
              </Stack>
            );
          })}
        </Stack>
      ) : (
        <Stack direction="row" useFlexGap sx={{ flexWrap: 'wrap', gap: 1.5 }}>
          {STAGE_COUNT_FIELDS.map((field) => (
            <TextField
              key={field.key}
              size="small"
              label={field.label}
              value={value[field.key] ?? ''}
              onChange={(e) => {
                const raw = e.target.value.trim();
                if (raw === '') {
                  onChange(field.key, null);
                  return;
                }
                // type=text + inputmode: type=number silently drops letters,
                // ignores maxlength and changes on scroll (GOV.UK's findings).
                if (!/^\d{1,4}$/.test(raw)) return;
                onChange(field.key, Math.min(parseInt(raw, 10), MAX_STAGE_COUNT));
              }}
              disabled={disabled}
              inputProps={{
                inputMode: 'numeric',
                pattern: '[0-9]*',
                enterKeyHint: 'done',
                'aria-label': field.label,
              }}
              helperText={field.helper}
              sx={{ width: { xs: '100%', sm: 190 } }}
            />
          ))}
        </Stack>
      )}

      <Stack direction="row" spacing={1} sx={{ mt: 1.5, flexWrap: 'wrap', gap: 1 }}>
        <Button
          size="small"
          variant="outlined"
          onClick={markRestNoneSeen}
          disabled={disabled || allRecorded}
          sx={{ textTransform: 'none' }}
        >
          {anyRecorded ? 'Mark the rest as none seen' : 'None seen for any'}
        </Button>
        {anyRecorded && (
          <Button
            size="small"
            color="inherit"
            onClick={() => STAGE_COUNT_KEYS.forEach((key) => onChange(key, null))}
            disabled={disabled}
            sx={{ textTransform: 'none' }}
          >
            Clear
          </Button>
        )}
      </Stack>

      {warnings.length > 0 && (
        // Soft on purpose: the record still saves. A block here would push
        // surveyors into entering a wrong number to get past it.
        <Alert severity="warning" sx={{ mt: 1.5 }}>
          {warnings.map((warning) => (
            <Typography key={warning} variant="body2">
              {warning}
            </Typography>
          ))}
        </Alert>
      )}

      {tier && (
        <Tooltip title={tier.evidence}>
          <Chip
            size="small"
            label={tier.label}
            sx={{
              mt: 1.5,
              bgcolor: CATEGORY_COLORS[tier.category],
              color: 'white',
              fontWeight: 600,
            }}
          />
        </Tooltip>
      )}
    </Box>
  );
}
