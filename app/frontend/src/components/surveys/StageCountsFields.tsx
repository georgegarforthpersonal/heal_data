/**
 * Life stage & behaviour counts (BDS Odonata recording form).
 *
 * Five compact steppers, one per BDS column, in the same − [typable] +
 * language as the Adults (total) control above them — smaller, so size makes
 * the hierarchy (the total is the every-record field; these are occasional).
 * Every count defaults to 0: the UI does not distinguish "not recorded" from
 * "looked and saw none" (George's call, Aug 2026), so there is no not-recorded
 * dash, no bulk "none seen" action, and no Tap/Type mode split.
 *
 * Counts bounded by the adult total (pairs ×2, ovipositing ×1 — see
 * stageCountCap) stop hard at their cap: + disables, typed entry clamps, and
 * the row says why. Lowering the total after entry can still strand a value
 * over its cap, so over-cap values render as errors and the parent blocks
 * saving.
 *
 * The panel stays collapsed until something positive is recorded — most
 * records are an adult count and nothing else.
 */

import { useEffect, useState } from 'react';
import { Alert, Box, ButtonBase, Chip, Collapse, Stack, Typography } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

import {
  MAX_STAGE_COUNT,
  STAGE_COUNT_FIELDS,
  deriveBreedingTier,
  stageCountCap,
  stageCountErrors,
  summariseStageCounts,
  type StageCountKey,
  type StageCounts,
} from '../../config/stageCounts';
import { notionColors } from '../../theme';
import { CATEGORY_COLORS, CATEGORY_TEXT_COLOR } from './breedingConstants';
import NumberStepper from './NumberStepper';

interface StageCountsFieldsProps {
  value: StageCounts;
  onChange: (key: StageCountKey, next: number | null) => void;
  /** The sighting's Count field, used to derive the tier and cross-check totals. */
  adultTotal?: number | null;
  disabled?: boolean;
}

export default function StageCountsFields({
  value,
  onChange,
  adultTotal,
  disabled = false,
}: StageCountsFieldsProps) {
  const tier = deriveBreedingTier(value, adultTotal);
  const errors = stageCountErrors(value, adultTotal);
  const summary = summariseStageCounts(value);

  const [expanded, setExpanded] = useState(() => summariseStageCounts(value) !== null);

  // An error blocks saving, so never leave one folded away out of sight. This
  // is reachable by lowering the adult total after counts were entered.
  useEffect(() => {
    if (errors.length > 0) setExpanded(true);
  }, [errors.length]);

  return (
    <Box>
      <ButtonBase
        onClick={() => setExpanded((open) => !open)}
        aria-expanded={expanded}
        aria-controls="stage-counts-panel"
        sx={{
          width: '100%',
          minHeight: 48,
          px: 1,
          py: 1,
          borderRadius: 1.5,
          justifyContent: 'space-between',
          textAlign: 'left',
          gap: 1,
          '&:hover': { bgcolor: 'action.hover' },
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle2">Life stage &amp; behaviour</Typography>
          <Typography
            variant="caption"
            sx={{ color: summary ? 'text.secondary' : 'text.disabled', display: 'block' }}
          >
            {summary ?? 'Optional — breeding evidence'}
          </Typography>
        </Box>
        <Stack direction="row" alignItems="center" spacing={0.5} sx={{ flexShrink: 0 }}>
          {/* "Adults present" is derived from the count alone, so it would sit
              on every record saying nothing. Only show a tier that reports
              actual breeding evidence. */}
          {tier && tier.category !== 'non_breeding' && (
            <Chip
              size="small"
              label={tier.label}
              sx={{
                bgcolor: CATEGORY_COLORS[tier.category],
                color: CATEGORY_TEXT_COLOR,
                fontWeight: 600,
              }}
            />
          )}
          <ExpandMoreIcon
            sx={{
              transition: 'transform .2s',
              transform: expanded ? 'rotate(180deg)' : 'none',
              color: 'action.active',
            }}
          />
        </Stack>
      </ButtonBase>

      <Collapse in={expanded} id="stage-counts-panel">
        <Stack spacing={1.25} sx={{ pt: 1, px: 1 }}>
          {STAGE_COUNT_FIELDS.map((field) => {
            const current = value[field.key] ?? 0;
            const cap = stageCountCap(field.key, adultTotal);
            const max = cap ? Math.min(cap.max, MAX_STAGE_COUNT) : MAX_STAGE_COUNT;
            const atCap = cap !== null && current >= cap.max;
            return (
              <NumberStepper
                key={field.key}
                label={field.label}
                value={current}
                onChange={(next) => onChange(field.key, next)}
                min={0}
                max={max}
                size="small"
                labelPlacement="start"
                disabled={disabled}
                accentColor={notionColors[field.color].text}
                helperText={
                  atCap && !disabled ? `Capped at ${cap.max}: ${cap.reason}.` : undefined
                }
              />
            );
          })}
        </Stack>
      </Collapse>

      {errors.length > 0 && (
        // Hard: these states are impossible by definition, and the parent
        // blocks saving while any remain. Each message points at the fix.
        <Alert severity="error" sx={{ mt: 1.5 }}>
          {errors.map((error) => (
            <Typography key={error} variant="body2">
              {error}
            </Typography>
          ))}
        </Alert>
      )}
    </Box>
  );
}
