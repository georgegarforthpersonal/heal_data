/**
 * Per-species-type count chips — icon + number, the breakdown grammar used
 * on survey rows (via SpeciesCountChips).
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
}

export default function TypeCountChips({ counts, justify = 'flex-start' }: TypeCountChipsProps) {
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: justify, gap: 0.75 }}>
      {counts.map(({ type, count }) => {
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
    </Box>
  );
}
