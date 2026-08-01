/**
 * One-line read-only summary of a sighting's BDS stage counts: the derived
 * proof-of-breeding tier as a chip, then the counts in words. This is the
 * after-entry face of StageCountsFields — without it the evidence is only
 * visible inside the entry widget and the spreadsheet export, so a surveyor
 * can never confirm what they recorded.
 *
 * Renders nothing when no stage count was recorded ("Adults present" alone
 * would sit on every record saying nothing).
 */
import { Chip, Stack, Typography } from '@mui/material';
import {
  deriveBreedingTier,
  hasStageCounts,
  summariseStageCounts,
  type StageCounts,
} from '../../config/stageCounts';
import { CATEGORY_COLORS, CATEGORY_TEXT_COLOR } from './breedingConstants';

interface StageCountsSummaryProps {
  counts: StageCounts;
  adultTotal?: number | null;
}

export default function StageCountsSummary({ counts, adultTotal }: StageCountsSummaryProps) {
  if (!hasStageCounts(counts)) return null;
  const tier = deriveBreedingTier(counts, adultTotal);
  const summary = summariseStageCounts(counts);

  return (
    <Stack direction="row" alignItems="center" spacing={0.75} sx={{ flexWrap: 'wrap', rowGap: 0.5 }}>
      {tier && tier.category !== 'non_breeding' && (
        <Chip
          size="small"
          label={tier.label}
          title={tier.evidence}
          sx={{
            height: 22,
            fontSize: '0.72rem',
            bgcolor: CATEGORY_COLORS[tier.category],
            color: CATEGORY_TEXT_COLOR,
            fontWeight: 600,
          }}
        />
      )}
      {summary && (
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {summary}
        </Typography>
      )}
    </Stack>
  );
}
