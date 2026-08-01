/**
 * A single row in the Surveys panel's Scheduled list. The date — a single day
 * or a week range, with the year — is the identifier and heads the row; there
 * is no calendar tile or icon (a week has no single day to pin one to). The
 * middle carries the location and status, never a title.
 *
 * Actions by state: overdue rows record only (the week has passed, surveyors
 * are captured on the record form); due-this-week rows both sign up and record
 * (people join surveys later in the current week) and carry a "Due this week"
 * chip so the current week stands out inside the single chronological list;
 * upcoming rows sign up only. Recorded surveys don't appear here at all —
 * they live in the panel's Recent rows.
 */
import { Box, Button, Typography } from '@mui/material';
import { Add, WarningAmberRounded } from '@mui/icons-material';
import type { ScheduledSurvey, Surveyor } from '../../services/api';
import { usePermissions } from '../../context/AuthContext';
import SelfSignupButton from './SelfSignupButton';
import SurveyorAvatars from './SurveyorAvatars';
import { recordButtonSx, groupColors } from '../../pages/groups/groupsTokens';
import { formatSurveyDate } from '../../pages/groups/surveyState';

interface SurveyWorklistRowProps {
  slot: ScheduledSurvey;
  state: 'needs-survey' | 'due-this-week' | 'upcoming';
  surveyors: Surveyor[];
  /** Surveyor ids assigned this session — rendered green. */
  greenIds?: Set<number>;
  /** Start recording a survey for this slot. */
  onAddSurvey: (slot: ScheduledSurvey) => void;
  /** Called after a one-click sign-up/withdraw with the new surveyor ids. */
  onSignupSaved: (slotId: number, surveyorIds: number[]) => void;
}

export default function SurveyWorklistRow({
  slot,
  state,
  surveyors,
  greenIds,
  onAddSurvey,
  onSignupSaved,
}: SurveyWorklistRowProps) {
  const needsSurvey = state === 'needs-survey';
  const dueThisWeek = state === 'due-this-week';
  // Rows that carry the sign-up toggle (with or without Record survey) crush
  // the date on phones, so they stack: date + avatars line, actions line.
  const stacked = !needsSurvey;
  // Recording a survey needs editor access; the button is hidden below that.
  // Sign up is the same one-click self toggle for every role — putting other
  // people on a survey is done on the survey itself, not here.
  const { canEditSurveys } = usePermissions();

  const recordButton = canEditSurveys ? (
    <Button
      variant="contained"
      startIcon={<Add sx={{ fontSize: 18 }} />}
      onClick={() => onAddSurvey(slot)}
      sx={recordButtonSx}
    >
      Record survey
    </Button>
  ) : null;

  const assignButton = (
    <SelfSignupButton slot={slot} assigned={surveyors} onSaved={onSignupSaved} />
  );

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: { xs: stacked ? 'column' : 'row', sm: 'row' },
        alignItems: { xs: stacked ? 'stretch' : 'center', sm: 'center' },
        gap: { xs: stacked ? 1 : 1.6, sm: 1.6 },
        px: 2.25,
        py: 1.6,
        borderTop: `1px solid ${groupColors.dividerInner}`,
        bgcolor: needsSurvey ? groupColors.amberRowBg : 'transparent',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0, flex: 1 }}>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography sx={{ fontSize: 14.5, fontWeight: 700, color: groupColors.textPrimary }} noWrap>
            {formatSurveyDate(slot)}
          </Typography>
          {slot.location_name && (
            <Typography sx={{ fontSize: 13, color: groupColors.textMuted, mt: 0.25 }} noWrap>
              {slot.location_name}
            </Typography>
          )}
          {needsSurvey && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.25 }}>
              <WarningAmberRounded sx={{ fontSize: 15, color: groupColors.amberText }} />
              <Typography sx={{ fontSize: 13.5, color: groupColors.amberText }}>
                Overdue — no survey recorded
              </Typography>
            </Box>
          )}
          {dueThisWeek && (
            <Box
              sx={{
                display: 'inline-block',
                mt: 0.5,
                px: 1,
                py: 0.3,
                borderRadius: '6px',
                bgcolor: '#DCE8F2',
                color: '#2C5F8A',
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              Due this week
            </Box>
          )}
        </Box>
        {/* On the stacked phone layout the date line's top-right slot always
            carries who's going — avatars, or "No surveyors yet" when empty;
            the buttons line below is actions only. */}
        {stacked && (
          <Box sx={{ display: { xs: 'flex', sm: 'none' }, flexShrink: 0 }}>
            <SurveyorAvatars surveyors={surveyors} greenIds={greenIds} />
          </Box>
        )}
      </Box>

      {needsSurvey ? (
        recordButton
      ) : dueThisWeek ? (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            flexWrap: 'wrap',
            gap: 1,
            flexShrink: 0,
          }}
        >
          {surveyors.length > 0 && (
            <Box sx={{ display: { xs: 'none', sm: 'flex' } }}>
              <SurveyorAvatars surveyors={surveyors} greenIds={greenIds} emptyLabel="" />
            </Box>
          )}
          {assignButton}
          {recordButton}
        </Box>
      ) : (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 1.25,
            flexShrink: 0,
          }}
        >
          {/* On xs the date line's slot carries the avatars/empty label */}
          <Box sx={{ display: { xs: 'none', sm: 'flex' } }}>
            <SurveyorAvatars surveyors={surveyors} greenIds={greenIds} />
          </Box>
          {assignButton}
        </Box>
      )}
    </Box>
  );
}
