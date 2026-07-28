/**
 * Icon for a species GROUP (species type): the Canopy badge illustration
 * where one exists — the same artwork the Surveys landing uses, so bird the
 * survey and Birds the species group finally speak one visual language —
 * and a placeholder (the wildlife glyph in a tinted circle) where a badge
 * hasn't been drawn yet.
 */
import { Box } from '@mui/material';
import { getSpeciesIcon } from '../../config/speciesTypes';
import butterfly from '../../assets/canopy/butterfly.png';
import dragonfly from '../../assets/canopy/dragonfly.png';
import genericBird from '../../assets/canopy/generic-bird.png';
import reptileSnake from '../../assets/canopy/reptile-snake.png';

/** Species-type name → Canopy badge, for the groups that have artwork. */
const GROUP_BADGES: Record<string, string> = {
  bird: genericBird,
  butterfly,
  'dragonfly-damselfly': dragonfly,
  reptile: reptileSnake,
};

export default function SpeciesGroupIcon({ type, size = 22 }: { type: string; size?: number }) {
  const badge = GROUP_BADGES[type];
  if (badge) {
    return (
      <img
        src={badge}
        alt=""
        width={size}
        height={size}
        style={{ display: 'block', flexShrink: 0, borderRadius: '50%' }}
      />
    );
  }
  const Icon = getSpeciesIcon(type);
  return (
    <Box
      sx={{
        width: size,
        height: size,
        borderRadius: '50%',
        bgcolor: '#E6EDE6',
        color: '#3E6A45',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <Icon sx={{ fontSize: size * 0.62 }} />
    </Box>
  );
}
