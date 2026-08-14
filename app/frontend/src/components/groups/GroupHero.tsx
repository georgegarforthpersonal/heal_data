/**
 * Neutral hero band for a group: survey-type badge + name + description.
 * The name is the page's <h1>. On phones a long description collapses to
 * two lines behind a More/Less toggle, so the worklist — the reason the
 * page was opened — stays close to the first screenful. No action button
 * (recording and sign-up live on the survey rows).
 */
import { useState } from 'react';
import { Box, ButtonBase, Paper, Typography, useMediaQuery, useTheme } from '@mui/material';
import type { SurveyTypeWithDetails } from '../../services/api';
import { groupColors } from '../../pages/groups/groupsTokens';
import SurveyTypeBadge from './SurveyTypeBadge';

interface GroupHeroProps {
  surveyType: SurveyTypeWithDetails;
}

/** Descriptions shorter than this never collapse — the toggle would cost
 * more space than it saves. */
const COLLAPSE_THRESHOLD = 140;

export default function GroupHero({ surveyType }: GroupHeroProps) {
  const theme = useTheme();
  const isPhone = useMediaQuery(theme.breakpoints.down('sm'));
  const [expanded, setExpanded] = useState(false);

  const description = surveyType.description ?? '';
  const collapsible = isPhone && description.length > COLLAPSE_THRESHOLD;
  const clamped = collapsible && !expanded;

  return (
    <Paper
      sx={{
        bgcolor: groupColors.paper,
        border: `1px solid ${groupColors.divider}`,
        borderRadius: '12px',
        boxShadow: 'none',
        px: 3,
        py: 2.75,
        display: 'flex',
        alignItems: 'center',
        gap: 2.5,
      }}
    >
      <SurveyTypeBadge surveyType={surveyType} size={60} radius={14} />
      <Box sx={{ minWidth: 0 }}>
        <Typography
          component="h1"
          sx={{ fontSize: 24, fontWeight: 600, color: groupColors.textPrimary, lineHeight: 1.2, m: 0 }}
        >
          {surveyType.name}
        </Typography>
        {description && (
          <>
            <Typography
              sx={{
                fontSize: 14,
                color: '#5d6660',
                mt: 0.5,
                ...(clamped
                  ? {
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }
                  : {}),
              }}
            >
              {description}
            </Typography>
            {collapsible && (
              <ButtonBase
                onClick={() => setExpanded((v) => !v)}
                aria-expanded={expanded}
                sx={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: groupColors.brandDark,
                  mt: 0.5,
                  borderRadius: '4px',
                  minHeight: 32,
                }}
              >
                {expanded ? 'Less' : 'More'}
              </ButtonBase>
            )}
          </>
        )}
      </Box>
    </Paper>
  );
}
