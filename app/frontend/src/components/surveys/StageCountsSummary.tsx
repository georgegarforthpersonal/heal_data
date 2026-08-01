/**
 * One-line read-only summary of a sighting's positive BDS stage counts
 * ("2 copulating pairs, 1 larva") for sighting cards and the survey detail
 * page — the after-entry face of StageCountsFields. Renders nothing when no
 * count is positive: zero and unrecorded read the same everywhere, and no
 * derived breeding-tier verdict is shown (cut on George's ask, Aug 2026).
 */
import { Typography } from '@mui/material';
import { summariseStageCounts, type StageCounts } from '../../config/stageCounts';

interface StageCountsSummaryProps {
  counts: StageCounts;
}

export default function StageCountsSummary({ counts }: StageCountsSummaryProps) {
  const summary = summariseStageCounts(counts);
  if (!summary) return null;

  return (
    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
      {summary}
    </Typography>
  );
}
