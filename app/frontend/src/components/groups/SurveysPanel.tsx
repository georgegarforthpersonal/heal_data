/**
 * The Surveys worklist panel, two groups mirroring the All surveys page's
 * Past | Scheduled vocabulary:
 *
 * The needs-attention rows — overdue weeks (amber) and this week's survey
 * (blue "Due this week" chip) — sit on top with no section header: their
 * chips are their labels, and a header's "next N" wording would misdescribe
 * them. "Scheduled" below them counts only genuinely-upcoming weeks, so its
 * "showing next 3" is literally true. The header's Record survey button is
 * the only way to record: the survey's date decides which week it fulfils,
 * so rows carry sign-up only. "Recent" is the last 3 recorded surveys with
 * their species counts — past results are always visible on the page, never
 * only behind a door. A recorded this-week survey simply appears as the
 * newest Recent row, so the current week never vanishes from the panel. The
 * "Past surveys" door at the foot leads to the full history.
 */
import { Box, Paper, Typography, Button } from '@mui/material';
import { Add } from '@mui/icons-material';
import type { ScheduledSurvey, Survey, Surveyor } from '../../services/api';
import { usePermissions } from '../../context/AuthContext';
import { groupCardSx, groupColors, recordButtonSx } from '../../pages/groups/groupsTokens';
import { buildWorklist } from '../../pages/groups/surveyState';
import SurveyWorklistRow from './SurveyWorklistRow';
import RecentSurveyRows from './RecentSurveyRows';
import AllSurveysDoor from './AllSurveysDoor';

interface SurveysPanelProps {
  /** All of this group's scheduled slots (open, fulfilled and cancelled). */
  slots: ScheduledSurvey[];
  resolveSurveyors: (ids: number[]) => Surveyor[];
  /** Recorded surveys total — shown on the Past surveys door. */
  recordedCount: number;
  /** Most recent recorded surveys, newest first (already capped upstream). */
  recentSurveys: Survey[];
  /** Icon for the zero-sightings chip on the Recent rows. */
  speciesType: string;
  greenIds?: Set<number>;
  /** Called after a one-click sign-up/withdraw with the new surveyor ids. */
  onSignupSaved: (slotId: number, surveyorIds: number[]) => void;
  /** Open a recorded survey from the Recent rows. */
  onOpenRecorded: (survey: Survey) => void;
  onViewAll: () => void;
  /** Record a survey outside the schedule (extra visits — the backend still
   * auto-links it to an open slot when the date falls in its window). */
  onRecordNew: () => void;
}

function SectionHeader({ label, color, suffix }: { label: string; color: string; suffix?: string }) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 1,
        px: 2.25,
        pt: 1.5,
        pb: 0.25,
        borderTop: `1px solid ${groupColors.dividerInner}`,
      }}
    >
      <Typography sx={{ fontSize: 11.5, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', color }}>
        {label}
      </Typography>
      {suffix && (
        <Typography sx={{ fontSize: 11.5, color: groupColors.textMuted }}>{suffix}</Typography>
      )}
    </Box>
  );
}

export default function SurveysPanel({
  slots,
  resolveSurveyors,
  recordedCount,
  recentSurveys,
  speciesType,
  greenIds,
  onSignupSaved,
  onOpenRecorded,
  onViewAll,
  onRecordNew,
}: SurveysPanelProps) {
  const { canEditSurveys } = usePermissions();
  const { dueThisWeek, overdue, upcoming, upcomingTotal } = buildWorklist(slots);
  // Chronological, soonest first: overdue windows precede this week's —
  // concatenation IS the sort.
  const attention: { slot: ScheduledSurvey; state: 'needs-survey' | 'due-this-week' }[] = [
    ...overdue.map((slot) => ({ slot, state: 'needs-survey' as const })),
    ...dueThisWeek.map((slot) => ({ slot, state: 'due-this-week' as const })),
  ];
  const recent = recentSurveys.slice(0, 3);

  return (
    <Paper sx={groupCardSx}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          px: 2.25,
          py: 1.75,
          borderBottom: `1px solid ${groupColors.divider}`,
        }}
      >
        <Typography sx={{ fontSize: 15, fontWeight: 600, color: groupColors.textPrimary }}>
          Surveys
        </Typography>
        {canEditSurveys && (
          <Button
            variant="contained"
            startIcon={<Add sx={{ fontSize: 18 }} />}
            onClick={onRecordNew}
            sx={recordButtonSx}
          >
            Record survey
          </Button>
        )}
      </Box>

      {/* Needs attention: overdue weeks, then this week's survey. No header —
          each row's chip is its label. */}
      {attention.map(({ slot, state }) => (
        <SurveyWorklistRow
          key={slot.id}
          slot={slot}
          state={state}
          surveyors={resolveSurveyors(slot.surveyor_ids)}
          greenIds={greenIds}
          onSignupSaved={onSignupSaved}
        />
      ))}

      {attention.length === 0 && upcomingTotal === 0 ? (
        // Empty diary: say so — the Recent rows below still carry the panel
        // between seasons.
        <Box sx={{ px: 2.25, py: recent.length > 0 ? 2 : 3 }}>
          <Typography sx={{ fontSize: 13.5, color: groupColors.textMuted }}>
            No scheduled surveys.
          </Typography>
        </Box>
      ) : (
        upcomingTotal > 0 && (
          <>
            <SectionHeader
              label={`Scheduled (${upcomingTotal})`}
              color={groupColors.brandDark}
              suffix={upcomingTotal > upcoming.length ? `showing next ${upcoming.length}` : undefined}
            />
            {upcoming.map((slot) => (
              <SurveyWorklistRow
                key={slot.id}
                slot={slot}
                state="upcoming"
                surveyors={resolveSurveyors(slot.surveyor_ids)}
                greenIds={greenIds}
                onSignupSaved={onSignupSaved}
              />
            ))}
          </>
        )
      )}

      {/* The last recorded surveys, results on show — the scent trail to the
          full history for anyone who came looking for "previous records". */}
      {recent.length > 0 && (
        <>
          <SectionHeader label="Recent" color={groupColors.textMuted} />
          <RecentSurveyRows
            surveys={recent}
            resolveSurveyors={resolveSurveyors}
            speciesType={speciesType}
            onOpenSurvey={onOpenRecorded}
          />
        </>
      )}

      <AllSurveysDoor summary={`${recordedCount} recorded · results & history`} onViewAll={onViewAll} />
    </Paper>
  );
}
