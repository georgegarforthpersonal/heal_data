/**
 * A type card on the Groups grid. The whole card is a button that opens the
 * group page. Shows the survey-type badge, name + sub-label, and one stat row
 * of three columns — surveys, species-or-sightings count, last survey — the
 * same three on every card, so the grid scans as one table. The schedule
 * doesn't appear here at all: due/upcoming slots are the group page's job.
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
  /** Third column: the most recently recorded survey. Null = none yet. */
  lastSurveyDate: string | null;
  onOpen: () => void;
}

/**
 * One column of the stat row. Same shape as the Species page's stat band —
 * value over a quiet sentence-case label — at card scale. Every value gets
 * the same type size, date included: uniform columns is the whole point of
 * the row, and a date set smaller read as a different kind of thing.
 */
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography
        sx={{ fontSize: 17, fontWeight: 600, lineHeight: 1.25, color: groupColors.textPrimary }}
        noWrap
      >
        {value}
      </Typography>
      <Typography sx={{ fontSize: 12.5, color: groupColors.textMuted, mt: 0.25 }} noWrap>
        {label}
      </Typography>
    </Box>
  );
}

export default function GroupCard({
  surveyType,
  surveyCount,
  countStat,
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
        borderRadius: '12px',
        boxShadow: 'none',
        overflow: 'hidden',
        transition: 'box-shadow 150ms ease, border-color 150ms ease, transform 150ms ease',
        '&:hover': {
          boxShadow: '0 6px 20px rgba(26,32,27,0.09), 0 2px 6px rgba(26,32,27,0.05)',
          borderColor: 'rgba(35,42,35,0.2)',
          transform: 'translateY(-1px)',
        },
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
              <Typography sx={{ fontSize: 12.5, color: groupColors.textMuted, lineHeight: 1.35 }}>
                {surveyType.description}
              </Typography>
            )}
          </Box>
          <ChevronRight sx={{ color: '#A9AFA9' }} />
        </Box>

        {/* Description-less headers carry less visual weight — tighten the gap
            so the card doesn't read as missing content. */}
        <Box sx={{ mt: 'auto', pt: surveyType.description ? 2 : 1.5 }}>
          <Box sx={{ height: '1px', bgcolor: groupColors.divider }} />
        </Box>

        {/* Equal thirds, not content-sized columns: every card's Surveys /
            Species / Last land on the same three positions across the grid,
            and a card missing its date keeps an empty cell rather than
            sliding columns about. The widest value the date can be is
            "Nov 2025" (formatRecordedDateShort drops the day on old dates),
            which fits a third at this size; noWrap is the backstop. */}
        <Box
          sx={{
            mt: surveyType.description ? 2 : 1.5,
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            columnGap: 1,
          }}
        >
          <Stat label="Surveys" value={String(surveyCount)} />
          <Stat label={countStat.label} value={String(countStat.value)} />
          {lastSurveyDate ? <Stat label="Last" value={lastSurveyDate} /> : <Box />}
        </Box>
      </ButtonBase>
    </Paper>
  );
}
