/**
 * The Surveys worklist panel, two groups mirroring the All surveys page's
 * Past | Scheduled vocabulary:
 *
 * The needs-attention rows — unrecorded past weeks (amber) and this week's
 * survey (blue "Due this week" chip) — sit on top with no section header:
 * their chips are their labels. A long amber backlog collapses to the two
 * most recent weeks plus an expander, so a lapsed season doesn't open as a
 * wall of amber. "Upcoming" below them shows the next 3 future weeks and
 * expands in place. Recording is offered from the header (unscheduled
 * extra visits) and from rows that still need a survey (carrying the slot's
 * week into the form). "Recent" is the last 3 recorded surveys with their
 * species counts. The "All surveys" door at the foot leads to the history.
 */
import { useState } from 'react';
import { Box, Paper, Typography, Button, ButtonBase } from '@mui/material';
import { Add } from '@mui/icons-material';
import type { ScheduledSurvey, Survey, Surveyor } from '../../services/api';
import { usePermissions } from '../../context/AuthContext';
import { groupCardSx, groupColors, panelTitleSx, recordButtonSx } from '../../pages/groups/groupsTokens';
import { buildWorklist } from '../../pages/groups/surveyState';
import SurveyWorklistRow from './SurveyWorklistRow';
import RecentSurveyRows from './RecentSurveyRows';
import AllSurveysDoor from './AllSurveysDoor';

/** Older unrecorded weeks beyond this many collapse behind an expander. */
const OVERDUE_SHOWN = 2;

interface SurveysPanelProps {
  /** All of this group's scheduled slots (open, fulfilled and cancelled). */
  slots: ScheduledSurvey[];
  resolveSurveyors: (ids: number[]) => Surveyor[];
  /** Recorded surveys total — shown on the All surveys door. */
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
  /** Record a survey for a specific slot — the form gets the slot's week. */
  onRecordSlot: (slot: ScheduledSurvey) => void;
}

function SectionHeader({ label, color, suffix }: { label: string; color: string; suffix?: React.ReactNode }) {
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
      <Typography
        component="h3"
        sx={{ fontSize: 11.5, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', color, m: 0 }}
      >
        {label}
      </Typography>
      {suffix}
    </Box>
  );
}

/** The inline "show all / show fewer" expander used by both sections. */
function ExpandLink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <ButtonBase
      onClick={onClick}
      sx={{ fontSize: 11.5, color: groupColors.brandDark, fontWeight: 600, borderRadius: '4px', px: 0.5 }}
    >
      {label}
    </ButtonBase>
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
  onRecordSlot,
}: SurveysPanelProps) {
  const { canEditSurveys } = usePermissions();
  const [showAllOverdue, setShowAllOverdue] = useState(false);
  const [showAllUpcoming, setShowAllUpcoming] = useState(false);
  const { dueThisWeek, overdue, upcoming, upcomingAll, upcomingTotal } = buildWorklist(slots);

  // The amber backlog: most recent first would lie about chronology, so keep
  // oldest-first but collapse all except the latest weeks behind an expander.
  const overdueShown = showAllOverdue ? overdue : overdue.slice(-OVERDUE_SHOWN);
  const overdueHidden = overdue.length - overdueShown.length;
  const upcomingShown = showAllUpcoming ? upcomingAll : upcoming;

  const recordSlot = canEditSurveys ? onRecordSlot : undefined;

  // Chronological, soonest first: unrecorded past windows precede this
  // week's — concatenation IS the sort.
  const attention: { slot: ScheduledSurvey; state: 'needs-survey' | 'due-this-week' }[] = [
    ...overdueShown.map((slot) => ({ slot, state: 'needs-survey' as const })),
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
        <Typography component="h2" sx={panelTitleSx}>
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

      {/* The collapsed amber backlog announces itself above the rows so the
          two shown weeks aren't mistaken for the whole story. */}
      {overdueHidden > 0 && (
        <Box sx={{ px: 2.25, py: 1, bgcolor: groupColors.amberRowBg, borderTop: `1px solid ${groupColors.dividerInner}` }}>
          <ExpandLink
            label={`${overdueHidden} earlier ${overdueHidden === 1 ? 'week' : 'weeks'} not recorded — show all`}
            onClick={() => setShowAllOverdue(true)}
          />
        </Box>
      )}
      {showAllOverdue && overdue.length > OVERDUE_SHOWN && (
        <Box sx={{ px: 2.25, py: 1, bgcolor: groupColors.amberRowBg, borderTop: `1px solid ${groupColors.dividerInner}` }}>
          <ExpandLink label="Show fewer" onClick={() => setShowAllOverdue(false)} />
        </Box>
      )}

      {/* Needs attention: unrecorded weeks, then this week's survey. No
          header — each row's chip is its label. */}
      {attention.map(({ slot, state }) => (
        <SurveyWorklistRow
          key={slot.id}
          slot={slot}
          state={state}
          surveyors={resolveSurveyors(slot.surveyor_ids)}
          greenIds={greenIds}
          onSignupSaved={onSignupSaved}
          onRecordSlot={recordSlot}
        />
      ))}

      {attention.length === 0 && upcomingTotal === 0 ? (
        // Empty diary: say who can fill it — the Recent rows below still
        // carry the panel between seasons.
        <Box sx={{ px: 2.25, py: recent.length > 0 ? 2 : 3 }}>
          <Typography sx={{ fontSize: 13.5, color: groupColors.textMuted }}>
            No surveys scheduled yet. Admins plan the season on the Scheduled tab.
          </Typography>
        </Box>
      ) : (
        upcomingTotal > 0 && (
          <>
            <SectionHeader
              label={`Upcoming (${upcomingTotal})`}
              color={groupColors.brandDark}
              suffix={
                upcomingTotal > upcoming.length ? (
                  <ExpandLink
                    label={showAllUpcoming ? 'show fewer' : `show all ${upcomingTotal}`}
                    onClick={() => setShowAllUpcoming((v) => !v)}
                  />
                ) : undefined
              }
            />
            {upcomingShown.map((slot) => (
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
