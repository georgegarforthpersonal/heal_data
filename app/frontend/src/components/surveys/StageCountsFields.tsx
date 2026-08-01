/**
 * Life stage & behaviour count inputs (BDS Odonata recording form).
 *
 * Shown for species types recorded with the BDS matrix (see
 * config/stageCounts). The adult total is the sighting's own Count field, so
 * only the five remaining columns are rendered here, followed by the derived
 * proof-of-breeding tier — derived rather than entered, because BDS treats the
 * tier as a summary of raw counts, not a field the recorder fills in.
 */

import { Box, Chip, Stack, TextField, Tooltip, Typography } from '@mui/material';

import {
  STAGE_COUNT_FIELDS,
  deriveBreedingTier,
  type StageCountKey,
  type StageCounts,
} from '../../config/stageCounts';
import { CATEGORY_COLORS } from './breedingConstants';

interface StageCountsFieldsProps {
  value: StageCounts;
  onChange: (key: StageCountKey, next: number | null) => void;
  /** The sighting's Count field, used only to derive the breeding tier. */
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

  return (
    <Box>
      <Typography variant="subtitle2" gutterBottom>
        Life stage &amp; behaviour
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ mb: 1.5, display: 'block' }}>
        British Dragonfly Society recording columns. Leave blank if not recorded; enter 0 if you
        looked and saw none.
      </Typography>

      <Stack
        direction="row"
        useFlexGap
        sx={{ flexWrap: 'wrap', gap: 1.5 }}
      >
        {STAGE_COUNT_FIELDS.map((field) => (
          <TextField
            key={field.key}
            size="small"
            type="number"
            label={field.label}
            value={value[field.key] ?? ''}
            onChange={(e) => {
              const raw = e.target.value;
              if (raw === '') {
                onChange(field.key, null);
                return;
              }
              const parsed = parseInt(raw, 10);
              if (Number.isNaN(parsed) || parsed < 0) return;
              onChange(field.key, parsed);
            }}
            disabled={disabled}
            inputProps={{ min: 0 }}
            helperText={field.helper}
            sx={{ width: { xs: '100%', sm: 190 } }}
          />
        ))}
      </Stack>

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
