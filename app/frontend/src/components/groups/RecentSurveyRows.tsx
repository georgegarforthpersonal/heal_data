/**
 * Rows for a short recorded-surveys list — date + location, species chips,
 * avatars, chevron, click-through to the survey. The shared body of every
 * "Recent" section: RecordPanel leads with it for unscheduled groups, and
 * SurveysPanel falls back to it when a scheduled group's diary is empty.
 * Headers stay with the panels; this is just the rows. Rows are real
 * buttons, so keyboards reach them.
 *
 * Row grammar (shared with the Scheduled rows): line 1 is identity only
 * (date, location); line 2 is payload from the left (species chips) with
 * people + affordance (avatars, chevron) at the right edge.
 */
import { Box, ButtonBase, Typography } from '@mui/material';
import { ChevronRight } from '@mui/icons-material';
import type { Survey, Surveyor } from '../../services/api';
import { groupColors } from '../../pages/groups/groupsTokens';
import { formatRecordedDate } from '../../pages/groups/surveyState';
import SpeciesCountChips from './SpeciesCountChips';
import SurveyorAvatars from './SurveyorAvatars';

interface RecentSurveyRowsProps {
  /** Recorded surveys, newest first (already capped upstream). */
  surveys: Survey[];
  resolveSurveyors: (ids: number[]) => Surveyor[];
  /** Icon for the zero-sightings chip when a survey has no recorded species. */
  speciesType: string;
  onOpenSurvey: (survey: Survey) => void;
}

export default function RecentSurveyRows({
  surveys,
  resolveSurveyors,
  speciesType,
  onOpenSurvey,
}: RecentSurveyRowsProps) {
  return (
    <>
      {surveys.map((survey) => (
        // Phones: rows stack uniformly — identity line, then chips from the
        // left with avatars + chevron at the right edge.
        <ButtonBase
          key={survey.id}
          onClick={() => onOpenSurvey(survey)}
          aria-label={`Open the survey recorded ${formatRecordedDate(survey.date)}`}
          sx={{
            width: '100%',
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            alignItems: { xs: 'stretch', sm: 'center' },
            gap: { xs: 1, sm: 1.6 },
            px: 2.25,
            py: 1.6,
            borderTop: `1px solid ${groupColors.dividerInner}`,
            textAlign: 'left',
            '&:hover': { bgcolor: groupColors.page },
          }}
        >
          <Box sx={{ minWidth: 0, flex: 1, width: { xs: '100%', sm: 'auto' } }}>
            <Typography sx={{ fontSize: 14.5, fontWeight: 700, color: groupColors.textPrimary }} noWrap>
              {formatRecordedDate(survey.date)}
            </Typography>
            {survey.location_name && (
              <Typography sx={{ fontSize: 13, color: groupColors.textMuted, mt: 0.25 }} noWrap>
                {survey.location_name}
              </Typography>
            )}
          </Box>
          {/* Bottom line, same grammar as the Scheduled rows' who-row: payload
              (species chips) from the left, people + affordance at the right
              edge. On phones space-between pushes them apart; on desktop the
              whole cell is content-sized and right-aligned anyway. */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.6,
              minWidth: 0,
              width: { xs: '100%', sm: 'auto' },
              justifyContent: 'space-between',
              flexShrink: { xs: 1, sm: 0 },
            }}
          >
            <SpeciesCountChips
              survey={survey}
              fallbackSpeciesType={speciesType}
              justify={{ xs: 'flex-start', sm: 'flex-end' }}
            />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.6, flexShrink: 0 }}>
              <SurveyorAvatars surveyors={resolveSurveyors(survey.surveyor_ids)} emptyLabel="" />
              <ChevronRight sx={{ fontSize: 18, color: groupColors.textMuted }} />
            </Box>
          </Box>
        </ButtonBase>
      ))}
    </>
  );
}
