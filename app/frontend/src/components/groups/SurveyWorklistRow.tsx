/**
 * A single row in the Surveys panel's worklist. The date — a single day
 * or a week range, with the year — is the identifier and heads the row, with
 * the status chip beside it ("Not recorded" amber, "Due this week" blue —
 * siblings, styled alike); the second line is the location. Never a title,
 * never a calendar tile (a week has no single day to pin one to).
 *
 * Every open row carries the one-click sign-up — including overdue weeks, so
 * a volunteer who wants to cover a missed week has an action. Recording
 * happens through the panel header's Record survey button: the survey's
 * date decides which week it fulfils (the backend links by window), so no
 * per-row record button is needed.
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

  return (
    <Box
      sx={{
        // Rows stack on phones into the two ideas the row holds: a when-row
        // (date + chip, location below) and a who-row (avatars + actions).
        // On desktop the two share a line while they fit; a busy who-row
        // ("Be the first to sign up" + Sign up, or a crowd of avatars)
        // wraps whole onto its own right-aligned line rather than squeezing
        // the date — the date is the row's identifier and never truncates.
        display: 'flex',
        flexDirection: { xs: 'column', sm: 'row' },
        flexWrap: 'wrap',
        alignItems: { xs: 'stretch', sm: 'center' },
        gap: { xs: 1, sm: 1.6 },
        px: 2.25,
        py: 1.6,
        borderTop: `1px solid ${groupColors.dividerInner}`,
        bgcolor: needsSurvey ? groupColors.amberRowBg : 'transparent',
      }}
    >
      {/* min-width fit-content = the date + chip line (the location line
          opts out below), so the when-cell can never be compressed past its
          first line and the row wraps instead. */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: { xs: 0, sm: 'fit-content' }, flex: '1 1 auto' }}>
        <Box sx={{ minWidth: { xs: 0, sm: 'fit-content' }, flex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
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
            // width 0 + minWidth 100%: fills the cell at layout time but
            // contributes nothing to its min-content, so a long location
            // name can't force the row to wrap — it truncates instead.
            <Typography sx={{ fontSize: 13, color: groupColors.textMuted, mt: 0.25, width: 0, minWidth: '100%' }} noWrap>
              {slot.location_name}
            </Typography>
          )}
        </Box>
      </Box>

      {/* The who-row: everyone going (avatars, or an invitation) beside the
          sign-up — on every open row, including not-recorded weeks. On
          phones it is its own full-width line under the when-row.
          Right-aligned at every width so people + affordance sit at the
          right edge, same as the Recent rows: one scanning rule for the
          whole panel. */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          flexWrap: 'wrap',
          gap: 1.25,
          flexShrink: 0,
          // Keeps the cluster on the right edge when it wraps to its own line.
          ml: 'auto',
        }}
      >
        <SurveyorAvatars
          surveyors={surveyors}
          greenIds={greenIds}
          emptyLabel="Be the first to sign up"
        />
        <SelfSignupButton slot={slot} assigned={surveyors} onSaved={onSignupSaved} />
      </Box>
    </Box>
  );
}
