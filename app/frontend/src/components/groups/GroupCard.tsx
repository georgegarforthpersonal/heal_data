/**
 * A type card on the Groups grid. The whole card is a button that opens the
 * group page. Shows the survey-type badge, name + sub-label, a pair of figures
 * (surveys, species-or-sightings count), and a one-line schedule footer.
 *
 * Dates live in the footer rather than in a third figure: a date is not a
 * number, and at figure size in a third of a card it wrapped to two lines and
 * turned an ordinary empty schedule into a bold "None scheduled".
 */
import { Box, Paper, ButtonBase, Typography } from '@mui/material';
import { ChevronRight } from '@mui/icons-material';
import type { SurveyTypeWithDetails } from '../../services/api';
import { groupColors } from '../../pages/groups/groupsTokens';
import SurveyTypeBadge from './SurveyTypeBadge';

interface GroupCardProps {
  surveyType: SurveyTypeWithDetails;
  surveyCount: number;
  /**
   * Middle stat: distinct species recorded across all of the type's species
   * types, or total sightings when the type is fixed to a single species (a
   * species count would always read 1 there).
   */
  countStat: { label: 'Species' | 'Sightings'; value: number };
  /**
   * Footer, left half: the next survey still to be carried out, `due` when its
   * window is the current one. Null for unscheduled groups, which never have
   * slots, and for scheduled groups with an empty diary — an ordinary state,
   * so the clause simply goes quiet rather than announcing itself.
   */
  nextSurvey: { date: string; due: boolean } | null;
  /** Footer, right half: the most recently recorded survey. Null = none yet. */
  lastSurveyDate: string | null;
  onOpen: () => void;
}

/**
 * One card figure. Same shape as the Species page's stat band — value over a
 * quiet sentence-case label — at card scale. Values WRAP rather than truncate:
 * a date or "None scheduled" needs two lines on a phone and a clipped stat is
 * worse than a tall one.
 */
function Stat({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography
        sx={{
          fontSize: 17,
          fontWeight: 600,
          lineHeight: 1.25,
          color: valueColor ?? groupColors.textPrimary,
        }}
      >
        {value}
      </Typography>
      <Typography sx={{ fontSize: 12.5, color: '#888', mt: 0.25 }}>{label}</Typography>
    </Box>
  );
}

export default function GroupCard({
  surveyType,
  surveyCount,
  countStat,
  dateStat,
  onOpen,
}: GroupCardProps) {
  return (
    // Grid rows stretch every card to the tallest one's height, so the hover
    // shadow belongs on the Paper — on the (content-height) button it would
    // paint a band across the card's unused bottom.
    <Paper
      sx={{
        height: '100%',
        border: `1px solid ${groupColors.divider}`,
        borderRadius: '10px',
        boxShadow: 'none',
        overflow: 'hidden',
        transition: 'box-shadow 120ms, border-color 120ms',
        '&:hover': { boxShadow: '0 4px 14px rgba(0,0,0,0.08)' },
      }}
    >
      <ButtonBase
        onClick={onOpen}
        sx={{
          width: '100%',
          height: '100%',
          display: 'block',
          textAlign: 'left',
          p: 2.5,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.75 }}>
          <SurveyTypeBadge surveyType={surveyType} size={46} radius={11} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: 17, fontWeight: 600, color: groupColors.textPrimary }} noWrap>
              {surveyType.name}
            </Typography>
            {surveyType.description && (
              // Wraps freely — descriptions are capped at 100 chars in admin
              // precisely so the card never has to truncate with "…".
              <Typography sx={{ fontSize: 12.5, color: '#888', lineHeight: 1.35 }}>
                {surveyType.description}
              </Typography>
            )}
          </Box>
          <ChevronRight sx={{ color: '#bbb' }} />
        </Box>

        {/* Description-less headers carry less visual weight — tighten the gap
            so the card doesn't read as missing content. */}
        <Box sx={{ height: '1px', bgcolor: groupColors.divider, my: surveyType.description ? 2 : 1.5 }} />

        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.4fr', gap: 1 }}>
          <Stat label="Surveys" value={String(surveyCount)} />
          <Stat label={countStat.label} value={String(countStat.value)} />
          {/* An upcoming date is actionable (brand green); a past one is just history. */}
          <Stat
            label={dateStat.label}
            value={dateStat.value ?? (dateStat.label === 'Next survey' ? 'None scheduled' : 'None yet')}
            valueColor={
              dateStat.value == null
                ? '#888'
                : dateStat.label === 'Next survey'
                  ? groupColors.brand
                  : undefined
            }
          />
        </Box>
      </ButtonBase>
    </Paper>
  );
}
