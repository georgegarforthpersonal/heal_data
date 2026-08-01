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
 * Two variants:
 * - 'inline' (the sighting modal): the rows sit directly under Adults (total)
 *   as one continuous counting block, with a quiet caption. Five small
 *   zero-default rows don't need hiding, and a fold read as a foreign widget
 *   between ordinary form fields.
 * - 'collapsible' (the desktop table): every dragonfly row carries these, so
 *   they fold behind a disclosure to keep the table scannable. Auto-opens
 *   when a sighting has positive counts or a blocking cap error.
 *
 * Counts bounded by the adult total (pairs ×2, ovipositing ×1 — see
 * stageCountCap) stop hard at their cap: + disables, typed entry clamps, and
 * the row says why. Lowering the total after entry can still strand a value
 * over its cap, so over-cap values render as errors and the parent blocks
 * saving.
 */

import { useEffect, useState } from 'react';
import { Alert, Box, ButtonBase, Collapse, Stack, Typography } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

import {
  MAX_STAGE_COUNT,
  STAGE_COUNT_FIELDS,
  stageCountCap,
  stageCountErrors,
  summariseStageCounts,
  type StageCountKey,
  type StageCounts,
} from '../../config/stageCounts';
import NumberStepper from './NumberStepper';

interface StageCountsFieldsProps {
  value: StageCounts;
  onChange: (key: StageCountKey, next: number | null) => void;
  /** The sighting's Count field, used to cross-check totals (pairs ×2 etc.). */
  adultTotal?: number | null;
  disabled?: boolean;
  /** 'inline' shows the rows always; 'collapsible' folds them (default). */
  variant?: 'inline' | 'collapsible';
}

export default function StageCountsFields({
  value,
  onChange,
  adultTotal,
  disabled = false,
  variant = 'collapsible',
}: StageCountsFieldsProps) {
  const errors = stageCountErrors(value, adultTotal);

  const [expanded, setExpanded] = useState(() => summariseStageCounts(value) !== null);

  // An error blocks saving, so never leave one folded away out of sight. This
  // is reachable by lowering the adult total after counts were entered.
  useEffect(() => {
    if (errors.length > 0) setExpanded(true);
  }, [errors.length]);

  const rows = (
    <Stack spacing={1.25}>
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
            helperText={atCap && !disabled ? `Capped at ${cap.max}: ${cap.reason}.` : undefined}
          />
        );
      })}
    </Stack>
  );

  const errorAlert = errors.length > 0 && (
    // Hard: these states are impossible by definition, and the parent
    // blocks saving while any remain. Each message points at the fix.
    <Alert severity="error" sx={{ mt: 1.5 }}>
      {errors.map((error) => (
        <Typography key={error} variant="body2">
          {error}
        </Typography>
      ))}
    </Alert>
  );

  if (variant === 'inline') {
    return (
      <Box>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
          Life stage &amp; behaviour
        </Typography>
        {rows}
        {errorAlert}
      </Box>
    );
  }

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
        {/* Title and chevron only — the counts below speak for themselves,
            so no summary line and no derived breeding-tier verdict. */}
        <Typography variant="subtitle2">Life stage &amp; behaviour</Typography>
        <Stack direction="row" alignItems="center" spacing={0.5} sx={{ flexShrink: 0 }}>
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
        <Box sx={{ pt: 1, px: 1 }}>{rows}</Box>
      </Collapse>

      {errorAlert}
    </Box>
  );
}
