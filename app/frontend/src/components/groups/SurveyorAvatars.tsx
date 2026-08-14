/**
 * Overlapping avatar group for the surveyors assigned to a survey. Falls back
 * to a muted invitation ("No one signed up yet") when empty. The group
 * carries all the names as an accessible label — individual circles are
 * decorative to assistive tech (their tooltips are pointer-only), so the
 * names are never mouse-only.
 */
import type { MouseEvent } from 'react';
import { Box, Tooltip, Typography } from '@mui/material';
import type { Surveyor } from '../../services/api';
import { groupColors } from '../../pages/groups/groupsTokens';
import { surveyorAvatarColor, surveyorInitials } from '../../pages/groups/groupsTokens';
import { surveyorFullName } from '../../utils/formatters';

// enterTouchDelay=0 makes a tap open the tooltip on touch devices. The tap
// must not bubble: avatars sit inside clickable rows, and navigating away
// would close the tooltip the tap just opened.
const touchProps = { enterTouchDelay: 0, leaveTouchDelay: 3000 } as const;
const stopClick = (e: MouseEvent) => e.stopPropagation();

interface SurveyorAvatarsProps {
  surveyors: Surveyor[];
  emptyLabel?: string;
  max?: number;
  /** Surveyor ids assigned in this session — rendered brand green. */
  greenIds?: Set<number>;
}

export default function SurveyorAvatars({
  surveyors,
  emptyLabel = 'No one signed up yet',
  max = 5,
  greenIds,
}: SurveyorAvatarsProps) {
  if (surveyors.length === 0) {
    // Occupy the same 28px-tall right-aligned slot as the circles, so rows
    // with and without surveyors line up.
    return (
      <Box sx={{ height: 28, display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
        <Typography variant="caption" sx={{ color: groupColors.textMuted, fontStyle: 'italic' }}>
          {emptyLabel}
        </Typography>
      </Box>
    );
  }

  const shown = surveyors.slice(0, max);
  const overflow = surveyors.length - shown.length;
  const allNames = surveyors.map(surveyorFullName).join(', ');

  return (
    <Box
      role="group"
      aria-label={`Surveyors: ${allNames}`}
      sx={{ display: 'flex', alignItems: 'center' }}
    >
      {shown.map((s, idx) => (
        <Tooltip key={s.id} title={surveyorFullName(s)} arrow {...touchProps}>
          <Box
            onClick={stopClick}
            aria-hidden
            sx={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              bgcolor: greenIds?.has(s.id) ? groupColors.brand : surveyorAvatarColor(s.id),
              color: '#fff',
              border: '2px solid #fff',
              ml: idx === 0 ? 0 : '-8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 10.5,
              fontWeight: 600,
              flexShrink: 0,
            }}
          >
            {surveyorInitials(s.first_name, s.last_name)}
          </Box>
        </Tooltip>
      ))}
      {overflow > 0 && (
        <Tooltip
          title={surveyors.slice(max).map(surveyorFullName).join(', ')}
          arrow
          {...touchProps}
        >
          <Box
            onClick={stopClick}
            aria-hidden
            sx={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              bgcolor: '#e0e0e0',
              color: '#555',
              border: '2px solid #fff',
              ml: '-8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 10.5,
              fontWeight: 600,
            }}
          >
            +{overflow}
          </Box>
        </Tooltip>
      )}
    </Box>
  );
}
