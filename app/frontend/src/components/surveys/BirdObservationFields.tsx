import { Stack, ToggleButtonGroup, ToggleButton, Tooltip } from '@mui/material';
import MaleIcon from '@mui/icons-material/Male';
import FemaleIcon from '@mui/icons-material/Female';
import FlightIcon from '@mui/icons-material/Flight';
import NatureIcon from '@mui/icons-material/Nature';
import MusicNoteIcon from '@mui/icons-material/MusicNote';

import type { BirdSex, BirdPosture } from '../../services/api';

interface BirdObservationFieldsProps {
  sex: BirdSex | null | undefined;
  posture: BirdPosture | null | undefined;
  singing: boolean | null | undefined;
  onChange: (fields: { sex?: BirdSex | null; posture?: BirdPosture | null; singing?: boolean | null }) => void;
  disabled?: boolean;
  compact?: boolean;
}

export function BirdObservationFields({
  sex,
  posture,
  singing,
  onChange,
  disabled = false,
  compact = false,
}: BirdObservationFieldsProps) {
  const btnSx = compact
    ? { px: 0.75, py: 0.25, minWidth: 0, fontSize: '0.75rem' }
    : { px: 1, py: 0.5, minWidth: 0, fontSize: '0.8rem' };

  const iconSize = compact ? 14 : 16;

  return (
    <Stack
      direction="row"
      spacing={compact ? 0.5 : 1}
      alignItems="center"
      flexWrap="wrap"
      sx={{ gap: compact ? 0.5 : 1 }}
    >
      {/* Sex toggle */}
      <Tooltip title="Sex" arrow>
        <ToggleButtonGroup
          value={sex ?? null}
          exclusive
          onChange={(_, val) => onChange({ sex: val as BirdSex | null })}
          size="small"
          disabled={disabled}
          sx={{ height: compact ? 28 : 32 }}
        >
          <ToggleButton value="male" aria-label="male" sx={btnSx}>
            <MaleIcon sx={{ fontSize: iconSize, mr: 0.25 }} />
            M
          </ToggleButton>
          <ToggleButton value="female" aria-label="female" sx={btnSx}>
            <FemaleIcon sx={{ fontSize: iconSize, mr: 0.25 }} />
            F
          </ToggleButton>
        </ToggleButtonGroup>
      </Tooltip>

      {/* Posture toggle */}
      <Tooltip title="Posture" arrow>
        <ToggleButtonGroup
          value={posture ?? null}
          exclusive
          onChange={(_, val) => onChange({ posture: val as BirdPosture | null })}
          size="small"
          disabled={disabled}
          sx={{ height: compact ? 28 : 32 }}
        >
          <ToggleButton value="flying" aria-label="flying" sx={btnSx}>
            <FlightIcon sx={{ fontSize: iconSize, mr: 0.25 }} />
            Fly
          </ToggleButton>
          <ToggleButton value="perched" aria-label="perched" sx={btnSx}>
            <NatureIcon sx={{ fontSize: iconSize, mr: 0.25 }} />
            Pch
          </ToggleButton>
        </ToggleButtonGroup>
      </Tooltip>

      {/* Singing toggle */}
      <Tooltip title="Singing" arrow>
        <ToggleButtonGroup
          value={singing ? 'singing' : null}
          onChange={(_, val) => onChange({ singing: val === 'singing' ? true : null })}
          size="small"
          disabled={disabled}
          sx={{ height: compact ? 28 : 32 }}
        >
          <ToggleButton value="singing" aria-label="singing" sx={btnSx}>
            <MusicNoteIcon sx={{ fontSize: iconSize, mr: 0.25 }} />
            {!compact && 'Sing'}
          </ToggleButton>
        </ToggleButtonGroup>
      </Tooltip>
    </Stack>
  );
}
