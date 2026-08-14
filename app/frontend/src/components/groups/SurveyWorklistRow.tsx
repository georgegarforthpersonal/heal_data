/**
 * A single row in the Surveys panel's worklist. The date — a single day
 * or a week range, with the year — is the identifier and heads the row, with
 * the status chip beside it ("Not recorded" amber, "Due this week" blue —
 * siblings, styled alike); the second line is the location. Never a title,
 * never a calendar tile (a week has no single day to pin one to).
 *
 * Every open row carries the one-click sign-up — including overdue weeks, so
 * a volunteer who wants to cover a missed week has an action. Rows that still
 * need a survey (due this week / overdue) also offer Record, which carries
 * the slot's window into the form so the date lands in the right week.
 */
import { Box, Button, Typography } from '@mui/material';
import { Add } from '@mui/icons-material';
import type { ScheduledSurvey, Surveyor } from '../../services/api';
import SelfSignupButton from './SelfSignupButton';
import SurveyorAvatars from './SurveyorAvatars';
import { groupColors, recordButtonSx } from '../../pages/groups/groupsTokens';
import { formatSurveyDate } from '../../pages/groups/surveyState';

interface SurveyWorklistRowProps {
  slot: ScheduledSurvey;
  state: 'needs-survey' | 'due-this-week' | 'upcoming';
  surveyors: Surveyor[];
  /** Surveyor ids assigned this session — rendered green. */
  greenIds?: Set<number>;
  /** Called after a one-click sign-up/withdraw with the new surveyor ids. */
  onSignupSaved: (slotId: number, surveyorIds: number[]) => void;
  /** Record a survey for this slot (undefined = viewer, no record action). */
  onRecordSlot?: (slot: ScheduledSurvey) => void;
}

export default function SurveyWorklistRow({
  slot,
  state,
  surveyors,
  greenIds,
  onSignupSaved,
  onRecordSlot,
}: SurveyWorklistRowProps) {
  const needsSurvey = state === 'needs-survey';
  const dueThisWeek = state === 'due-this-week';
  const showRecord = onRecordSlot != null && (needsSurvey || dueThisWeek);

  return (
    <Box
      sx={{
        // Rows stack on phones into the two ideas the row holds: a when-row
        // (date + chip, location below) and a who-row (avatars + actions).
        display: 'flex',
        flexDirection: { xs: 'column', sm: 'row' },
        alignItems: { xs: 'stretch', sm: 'center' },
        gap: { xs: 1, sm: 1.6 },
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
            {/* Not recorded and Due this week are sibling states, so their
                chips share a shape and differ only in colour. */}
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
                {needsSurvey ? 'Not recorded' : 'Due this week'}
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

      {/* The who-row: everyone going (avatars, or an invitation) beside the
          actions. On phones it is its own full-width line under the when-row —
          date/chip and people never share a line, so a crowd of sign-ups
          can't crush the date. */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: { xs: 'space-between', sm: 'flex-end' },
          flexWrap: 'wrap',
          gap: 1.25,
          flexShrink: 0,
        }}
      >
        <SurveyorAvatars
          surveyors={surveyors}
          greenIds={greenIds}
          emptyLabel="Be the first to sign up"
        />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <SelfSignupButton slot={slot} assigned={surveyors} onSaved={onSignupSaved} />
          {showRecord && (
            <Button
              variant="contained"
              startIcon={<Add sx={{ fontSize: 18 }} />}
              onClick={() => onRecordSlot(slot)}
              sx={recordButtonSx}
            >
              Record
            </Button>
          )}
        </Box>
      </Box>
    </Box>
  );
}
