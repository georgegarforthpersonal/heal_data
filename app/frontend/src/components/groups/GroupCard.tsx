/**
 * A type card on the Groups grid. The whole card is a button that opens the
 * group page. Shows the survey-type badge, name + sub-label, and one stat row
 * of three columns — surveys, species-or-sightings count, last survey — the
 * same three on every card, so the grid scans as one table. The schedule's
 * only appearance is the Due pill in the header, and only while a survey is
 * actually due: upcoming-but-not-due dates are diary detail that belongs on
 * the group page.
 *
 * The date shares the row but not the figures' type size — set as a figure it
 * wrapped to two lines. At date size it fits, and an absent date leaves its
 * cell empty instead of announcing itself.
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
   * The next slot's window label, set only while that window is the current
   * one — i.e. a survey is due right now. Null for unscheduled groups, empty
   * diaries, and slots that are merely upcoming; the pill only ever calls for
   * action, so its absence is the ordinary state and needs no placeholder.
   */
  dueWindow: string | null;
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
function Stat({ label, value, date }: { label: string; value: string; date?: boolean }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography
        sx={{
          fontSize: date ? 13.5 : 17,
          fontWeight: 600,
          lineHeight: 1.25,
          color: groupColors.textPrimary,
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
  dueWindow,
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
            {dueWindow && (
              <Box
                sx={{
                  display: 'inline-flex',
                  mt: 0.75,
                  px: 1,
                  py: 0.25,
                  borderRadius: '999px',
                  bgcolor: groupColors.brandTint,
                  color: groupColors.brandDark,
                  fontSize: 11.5,
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                }}
              >
                Due {dueWindow}
              </Box>
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
            Species / Last land on the same three positions across the grid,
            and a card missing its date keeps an empty cell rather than
            sliding columns about. The date column is wider — equal thirds
            would starve it and pad the counts. Dates truncate rather than
            wrap; a two-line date is what this row exists to avoid. */}
        <Box
          sx={{
            mt: surveyType.description ? 2 : 1.5,
            display: 'grid',
            alignItems: 'flex-end',
            columnGap: 1,
            rowGap: 1.5,
            // The fractions are proportional to what each column actually
            // holds — "Sightings" and a "13 Nov 2025" need more room than a
            // count does. Viewports under ~390px can't fit all three across:
            // there the date drops to a second row rather than truncate.
            gridTemplateColumns: 'repeat(2, 1fr)',
            '@media (min-width:390px)': {
              gridTemplateColumns: '1fr 1.15fr 1.9fr',
            },
          }}
        >
          <Stat label="Surveys" value={String(surveyCount)} />
          <Stat label={countStat.label} value={String(countStat.value)} />
          {lastSurveyDate ? <Stat label="Last" value={lastSurveyDate} date /> : <Box />}
        </Box>
      </ButtonBase>
    </Paper>
  );
}
