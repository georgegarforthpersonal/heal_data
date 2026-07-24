/**
 * Per-species-type count chips for a recorded survey row — the same
 * breakdown the main Surveys list shows (a survey type can collect several
 * species types, e.g. bird surveys also log mammals), restyled for group
 * cards. Falls back to a single zero chip with the group's primary species
 * icon when the survey has no sightings.
 */
import { Box } from '@mui/material';
import type { Survey } from '../../services/api';
import { getSpeciesIcon } from '../../config/speciesTypes';
import { typeCountChipSx as chipSx } from '../../pages/groups/groupsTokens';
import TypeCountChips from './TypeCountChips';

interface SpeciesCountChipsProps {
  survey: Survey;
  /** Icon for the zero chip when the survey has no sightings. */
  fallbackSpeciesType: string;
  /** Wrap alignment — accepts responsive values (stacked phone rows start-align). */
  justify?: string | Record<string, string>;
}

export default function SpeciesCountChips({
  survey,
  fallbackSpeciesType,
  justify = 'flex-end',
}: SpeciesCountChipsProps) {
  if (survey.species_breakdown.length === 0) {
    const Icon = getSpeciesIcon(fallbackSpeciesType);
    return (
      <Box sx={chipSx}>
        <Icon sx={{ fontSize: 15 }} />
        0
      </Box>
    );
  }
  return <TypeCountChips counts={survey.species_breakdown} justify={justify} />;
}
