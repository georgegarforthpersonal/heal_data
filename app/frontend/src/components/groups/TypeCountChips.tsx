/**
 * Per-species-type count chips — icon + number, the grammar survey rows
 * already taught. Reused wherever a count needs its "of what" made explicit
 * (survey row sighting breakdowns, group species-count breakdowns). An
 * optional cap collapses the tail into a "+n" chip for tight summary cards.
 */
import { Box, Tooltip } from '@mui/material';
import { getSpeciesIcon, formatSpeciesCount } from '../../config/speciesTypes';
import { typeCountChipSx as chipSx } from '../../pages/groups/groupsTokens';

export interface TypeCount {
  type: string;
  count: number;
}

interface TypeCountChipsProps {
  counts: TypeCount[];
  /** Wrap alignment — accepts responsive values (stacked phone rows start-align). */
  justify?: string | Record<string, string>;
  /** Show at most this many chips; the rest collapse into "+n". */
  max?: number;
}

export default function TypeCountChips({ counts, justify = 'flex-start', max }: TypeCountChipsProps) {
  const visible = max != null ? counts.slice(0, max) : counts;
  const hidden = counts.length - visible.length;
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: justify, gap: 0.75 }}>
      {visible.map(({ type, count }) => {
        const Icon = getSpeciesIcon(type);
        return (
          <Tooltip key={type} title={formatSpeciesCount(type, count)} arrow>
            <Box sx={chipSx}>
              <Icon sx={{ fontSize: 15 }} />
              {count}
            </Box>
          </Tooltip>
        );
      })}
      {hidden > 0 && (
        <Tooltip
          title={counts
            .slice(visible.length)
            .map(({ type, count }) => formatSpeciesCount(type, count))
            .join(', ')}
          arrow
        >
          <Box sx={chipSx}>+{hidden}</Box>
        </Tooltip>
      )}
    </Box>
  );
}
