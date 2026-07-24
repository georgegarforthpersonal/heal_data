/**
 * A type card on the Groups grid. The whole card is a button that opens the
 * group page. Shows the survey-type badge, name + sub-label, and a three-stat
 * row (surveys, species-or-sightings count, next/last survey).
 */
import { Box, Paper, ButtonBase, Typography } from '@mui/material';
import { ChevronRight } from '@mui/icons-material';
import type { SurveyTypeWithDetails } from '../../services/api';
import { groupColors } from '../../pages/groups/groupsTokens';
import SurveyTypeBadge from './SurveyTypeBadge';
import TypeCountChips from './TypeCountChips';

interface GroupCardProps {
  surveyType: SurveyTypeWithDetails;
  surveyCount: number;
  /**
   * Middle stat: distinct species per species type (chips — "101 Species"
   * on a bird group that also logs mammals reads as 101 birds, so the
   * breakdown carries the "of what"), or total sightings when the type is
   * fixed to a single species (a species count would always read 1 there).
   */
  countStat:
    | { label: 'Sightings'; value: number }
    | { label: 'Species'; perType: { type: string; count: number }[] };
  /**
   * Third stat: the soonest scheduled survey for worklist groups, or the most
   * recently recorded one for unscheduled groups. Null value = none yet.
   */
  dateStat: { label: 'Next survey' | 'Last survey'; value: string | null };
  onOpen: () => void;
}

function Stat({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography
        sx={{ fontSize: 13, fontWeight: 600, color: valueColor ?? groupColors.textPrimary }}
        noWrap
      >
        {value}
      </Typography>
      <Typography sx={{ fontSize: 11, color: '#888' }}>{label}</Typography>
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
    <Paper sx={{ border: `1px solid ${groupColors.divider}`, borderRadius: '10px', boxShadow: 'none', overflow: 'hidden' }}>
      <ButtonBase
        onClick={onOpen}
        sx={{
          width: '100%',
          display: 'block',
          textAlign: 'left',
          p: 2.5,
          transition: 'box-shadow 120ms, border-color 120ms',
          '&:hover': { boxShadow: '0 4px 14px rgba(0,0,0,0.08)' },
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
          {countStat.label === 'Sightings' ? (
            <Stat label="Sightings" value={String(countStat.value)} />
          ) : (
            <Stat
              label="Species"
              value={String(countStat.perType.reduce((sum, t) => sum + t.count, 0))}
            />
          )}
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

        {/* The count's "of what": a full-width breakdown strip below the stat
            row (never inside it — pills in a stat cell wreck the row's
            scannable number+label grammar). Only when the count spans types;
            every type shows, wrapping as needed (George: no "+n"). */}
        {countStat.label === 'Species' && countStat.perType.length > 1 && (
          <Box sx={{ mt: 1.5 }}>
            <TypeCountChips counts={countStat.perType} />
          </Box>
        )}
      </ButtonBase>
    </Paper>
  );
}
