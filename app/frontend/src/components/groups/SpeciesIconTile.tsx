/**
 * The tinted icon tile used where a survey type has no badge artwork —
 * a species glyph in a quiet tinted circle. Callers pass the tint.
 */
import { Box } from '@mui/material';
import { getSpeciesIcon } from '../../config/speciesTypes';

interface SpeciesIconTileProps {
  speciesType: string;
  size: number;
  radius: number;
  bg: string;
  fg: string;
}

export default function SpeciesIconTile({ speciesType, size, radius, bg, fg }: SpeciesIconTileProps) {
  const Icon = getSpeciesIcon(speciesType);
  return (
    <Box
      sx={{
        width: size,
        height: size,
        borderRadius: `${radius}px`,
        bgcolor: bg,
        color: fg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <Icon sx={{ fontSize: size * 0.5 }} />
    </Box>
  );
}
