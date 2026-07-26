/**
 * A type card on the Groups grid. The whole card is a button that opens the
 * group page. Shows the survey-type badge, name + sub-label, and one stat row
 * of up to four columns: surveys, species-or-sightings count, last survey,
 * next survey.
 *
 * The dates share the row but not the figures' type size — set as figures they
 * wrapped to two lines and turned an ordinary empty schedule into a bold
 * "None scheduled". At date size all four fit one line across the card, and an
 * absent date drops its column instead of announcing itself.
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
   * Fourth column: the next survey still to be carried out, `due` when its
   * window is the current one. Null for unscheduled groups, which never have
   * slots, and for scheduled groups with an empty diary — an ordinary state,
   * so the column simply goes rather than announcing itself.
   */
  nextSurvey: { date: string; due: boolean } | null;
  /** Third column: the most recently recorded survey. Null = none yet. */
  lastSurveyDate: string | null;
  onOpen: () => void;
}

/**
 * One column of the stat row. Same shape as the Species page's stat band —
 * value over a quiet sentence-case label — at card scale.
 *
 * A count is the headline size; a date is set smaller, because four figures'
 * worth of date does not fit the width of a third of the grid, and because the
 * counts should lead. Both share the label size, and the row bottom-aligns, so
 * the labels sit on one baseline whatever the value above them.
 */
function Stat({
  label,
  value,
  date,
  color,
}: {
  label: string;
  value: string;
  date?: boolean;
  color?: string;
}) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography
        sx={{
          fontSize: date ? 13.5 : 17,
          fontWeight: 600,
          lineHeight: 1.25,
          color: color ?? groupColors.textPrimary,
        }}
        noWrap
      >
        {value}
      </Typography>
      <Typography sx={{ fontSize: 12.5, color: '#888', mt: 0.25 }} noWrap>
        {label}
      </Typography>
    </Box>
  );
}

export default function GroupCard({
  surveyType,
  surveyCount,
  countStat,
  nextSurvey,
  lastSurveyDate,
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
        // A column so the rule and the stat row can sit on the card's floor
        // (mt: auto below): cards in a row are stretched to a common height,
        // and stat rows hanging off differently-sized descriptions read as
        // misaligned. The slack goes above the rule, where it passes for the
        // padding around a section break.
        sx={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch',
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
        <Box sx={{ mt: 'auto', pt: surveyType.description ? 2 : 1.5 }}>
          <Box sx={{ height: '1px', bgcolor: groupColors.divider }} />
        </Box>

        {/* Fixed columns, not content-sized ones: every card's Surveys /
            Species / Last / Next land on the same four positions across the
            grid, and a card missing a date keeps an empty cell rather than
            sliding its remaining columns about. The date columns are wider —
            equal quarters would starve them and pad the counts. Dates truncate
            rather than wrap; a two-line date is what this row exists to avoid.
            The row reads left to right in time: counts, then what happened,
            then what's coming. */}
        <Box
          sx={{
            mt: surveyType.description ? 2 : 1.5,
            display: 'grid',
            alignItems: 'flex-end',
            columnGap: 1,
            rowGap: 1.5,
            // Four across need ~272px of column content, which a viewport
            // under ~390px can't give: there the dates drop to a second row
            // rather than truncate. Above it the fractions are proportional to
            // what each column actually holds — "Sightings" and a
            // "13 Nov 2025" need more room than a count does.
            gridTemplateColumns: 'repeat(2, 1fr)',
            '@media (min-width:390px)': {
              gridTemplateColumns: '1fr 1.15fr 1.75fr 2.1fr',
            },
          }}
        >
          <Stat label="Surveys" value={String(surveyCount)} />
          <Stat label={countStat.label} value={String(countStat.value)} />
          {lastSurveyDate ? <Stat label="Last" value={lastSurveyDate} date /> : <Box />}
          {nextSurvey ? (
            <Stat
              label={nextSurvey.due ? 'Due' : 'Next'}
              value={nextSurvey.date}
              date
              color={groupColors.brandDark}
            />
          ) : (
            <Box />
          )}
        </Box>
      </ButtonBase>
    </Paper>
  );
}
