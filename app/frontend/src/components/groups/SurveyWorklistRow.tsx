/**
 * A single row in the Surveys panel's Scheduled list. The date — a single day
 * or a week range, with the year — is the identifier and heads the row, with
 * the status chip beside it ("Overdue" amber, "Due this week" blue — siblings,
 * styled alike); the second line is the location. Never a title, never a
 * calendar tile (a week has no single day to pin one to).
 *
 * No row records a survey: the panel header's Record survey button is the one
 * way in, and the survey's date decides which week it fulfils (the backend
 * links by window). Due-this-week and upcoming rows carry the one-click
 * sign-up; overdue rows are information only. Recorded surveys don't appear
 * here at all — they live in the panel's Recent rows.
 */
import { Box, Typography } from '@mui/material';
import type { ScheduledSurvey, Surveyor } from '../../services/api';
import SelfSignupButton from './SelfSignupButton';
import SurveyorAvatars from './SurveyorAvatars';
import { groupColors } from '../../pages/groups/groupsTokens';
import { formatSurveyDate } from '../../pages/groups/surveyState';

interface SurveyWorklistRowProps {
  slot: ScheduledSurvey;
  state: 'needs-survey' | 'due-this-week' | 'upcoming';
  surveyors: Surveyor[];
  /** Surveyor ids assigned this session — rendered green. */
  greenIds?: Set<number>;
  /** Called after a one-click sign-up/withdraw with the new surveyor ids. */
  onSignupSaved: (slotId: number, surveyorIds: number[]) => void;
}

export default function SurveyWorklistRow({
  slot,
  state,
  surveyors,
  greenIds,
  onSignupSaved,
}: SurveyWorklistRowProps) {
  const needsSurvey = state === 'needs-survey';
  const dueThisWeek = state === 'due-this-week';
  // Rows carrying the sign-up toggle stack on phones into the two ideas the
  // row holds: a when-row (date + chip, location below) and a who-row
  // (avatars + sign-up). Overdue rows have no who-row at all.
  const stacked = !needsSurvey;

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
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: 14.5, fontWeight: 700, color: groupColors.textPrimary }} noWrap>
              {formatSurveyDate(slot)}
            </Typography>
            {/* Overdue and Due this week are sibling states, so their chips
                share a shape and differ only in colour. */}
            {(needsSurvey || dueThisWeek) && (
              <Box
                sx={{
                  px: 1,
                  py: 0.3,
                  borderRadius: '6px',
                  bgcolor: needsSurvey ? '#FBF3DB' : '#DCE8F2',
                  color: needsSurvey ? groupColors.amberMonth : '#2C5F8A',
                  fontSize: 12,
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                {needsSurvey ? 'Overdue' : 'Due this week'}
              </Box>
            )}
          </Box>
          {slot.location_name && (
            <Typography sx={{ fontSize: 13, color: groupColors.textMuted, mt: 0.25 }} noWrap>
              {slot.location_name}
            </Typography>
          )}
        </Box>
      </Box>

      {/* The who-row: everyone going (avatars, or "No surveyors yet") beside
          the sign-up action. On phones it is its own full-width line under
          the when-row — date/chip and people never share a line, so a crowd
          of sign-ups can't crush the date. Right-aligned at every width so
          people + affordance sit at the right edge, same as the Recent rows:
          one scanning rule for the whole panel. */}
      {stacked && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 1.25,
            flexShrink: 0,
          }}
        >
          <SurveyorAvatars surveyors={surveyors} greenIds={greenIds} />
          <SelfSignupButton slot={slot} assigned={surveyors} onSaved={onSignupSaved} />
        </Box>
      )}
    </Box>
  );
}
