/**
 * Life stage & behaviour counts (British Dragonfly Society Odonata form).
 *
 * The BDS recording form is a species x behaviour matrix: per species per
 * visit the recorder fills in Adults (total), Copulating pairs, Ovipositing
 * females, Larvae, Exuviae and Emerging adults. `Sighting.count` is the adult
 * total, so only the other five live here.
 *
 * This is deliberately shaped differently from the BTO breeding codes used for
 * birds. BTO asks the recorder to classify each individual with an evidence
 * code; BDS asks for raw counts and derives the proof-of-breeding tier from
 * them, and is explicit that the criteria "should not replace the recording of
 * raw data". So we store the counts and compute the tier (deriveBreedingTier).
 *
 * Sources:
 *   BDS Odonata Recording Form (9/11/22)
 *   BDS Proof of Breeding Criteria v4 (20/11/21)
 */

import type { BreedingCategory } from '../services/api';

/** The five BDS count columns beyond the adult total. */
export interface StageCounts {
  copulating_pairs?: number | null;
  ovipositing_females?: number | null;
  larvae?: number | null;
  exuviae?: number | null;
  emerging_adults?: number | null;
}

export type StageCountKey = keyof StageCounts;

export interface StageCountField {
  key: StageCountKey;
  label: string;
  /** Shown under the input; keeps the recording convention at the point of entry. */
  helper?: string;
  /**
   * Category identity only — never magnitude, and never the sole cue (WCAG
   * 1.4.1): every chip also carries its text label. Keys into `notionColors`.
   */
  color: 'purple' | 'pink' | 'blue' | 'green' | 'orange';
}

/** In BDS recording-form order. */
export const STAGE_COUNT_FIELDS: readonly StageCountField[] = [
  {
    key: 'copulating_pairs',
    label: 'Copulating pairs',
    helper: 'In tandem or the wheel. One pair counts as 1.',
    color: 'purple',
  },
  { key: 'ovipositing_females', label: 'Ovipositing females', color: 'pink' },
  { key: 'larvae', label: 'Larvae', color: 'blue' },
  {
    key: 'exuviae',
    label: 'Exuviae',
    helper: 'Cast larval skins — proof of successful breeding.',
    color: 'green',
  },
  {
    key: 'emerging_adults',
    label: 'Emerging adults',
    helper: 'Newly emerged (teneral) adults.',
    color: 'orange',
  },
] as const;

/** Reject fat-fingered repeats; no dragonfly count needs five digits. */
export const MAX_STAGE_COUNT = 9999;

export const STAGE_COUNT_KEYS: readonly StageCountKey[] = STAGE_COUNT_FIELDS.map((f) => f.key);

/**
 * Species types recorded with the BDS stage/behaviour matrix. Keyed by the
 * species type slug so this extends by data, not by another `allow_*` flag.
 */
const STAGE_COUNT_SPECIES_TYPES = new Set(['dragonfly-damselfly']);

/** Whether a species type is recorded with stage/behaviour counts. */
export function recordsStageCounts(speciesType: string | null | undefined): boolean {
  return !!speciesType && STAGE_COUNT_SPECIES_TYPES.has(speciesType);
}

/**
 * Copy just the stage-count fields off any sighting-shaped object.
 *
 * Always returns all five keys, with null for anything not recorded, so the
 * result can be spread both to build a payload and to clear counts off a draft
 * (a partial object would spread to nothing and silently leave stale values).
 */
export function pickStageCounts(source: StageCounts | null | undefined): StageCounts {
  const counts: StageCounts = {};
  for (const key of STAGE_COUNT_KEYS) {
    counts[key] = source?.[key] ?? null;
  }
  return counts;
}

/** True when any stage count has actually been recorded (0 counts as recorded). */
export function hasStageCounts(counts: StageCounts | null | undefined): boolean {
  if (!counts) return false;
  return STAGE_COUNT_KEYS.some((key) => counts[key] !== null && counts[key] !== undefined);
}

/**
 * Cross-field consistency warnings.
 *
 * These are soft: they never block a save. eBird's model — flag an implausible
 * record, ask for detail, still accept it — is the right one for field data,
 * because a wall makes surveyors enter a wrong number to get past it.
 *
 * Only arithmetic that is true by definition is checked. A copulating pair is
 * two adults and an ovipositing female is one adult, so the adult total (which
 * we ask to include them) cannot be smaller. Larvae, exuviae and emerging
 * adults are not adults, so they carry no such relationship.
 */
export function stageCountWarnings(
  counts: StageCounts | null | undefined,
  adultTotal: number | null | undefined,
): string[] {
  const c = counts ?? {};
  const warnings: string[] = [];
  if (typeof adultTotal !== 'number') return warnings;

  const pairs = c.copulating_pairs;
  if (typeof pairs === 'number' && pairs > 0 && adultTotal < pairs * 2) {
    warnings.push(
      `${pairs} copulating pair${pairs === 1 ? '' : 's'} means at least ${pairs * 2} adults, ` +
        `but Adults (total) is ${adultTotal}. Check the total includes paired individuals.`,
    );
  }

  const ovipositing = c.ovipositing_females;
  if (typeof ovipositing === 'number' && ovipositing > 0 && adultTotal < ovipositing) {
    warnings.push(
      `${ovipositing} ovipositing female${ovipositing === 1 ? '' : 's'} recorded, ` +
        `but Adults (total) is only ${adultTotal}.`,
    );
  }

  return warnings;
}

export interface BreedingTier {
  label: string;
  /** Reuses the BTO category vocabulary so tier colours stay consistent app-wide. */
  category: BreedingCategory;
  /** Which counts produced this verdict, for an explanatory tooltip. */
  evidence: string;
}

const positive = (value: number | null | undefined): boolean =>
  typeof value === 'number' && value > 0;

/**
 * Derive the BDS proof-of-breeding tier from the recorded counts.
 *
 * Per BDS Proof of Breeding Criteria v4:
 *   Successful breeding — Confirmed: exuvia present (absolute proof).
 *   Successful breeding — Probable: larva, ovipositing female, or teneral.
 *   Possible breeding:              pair copulating.
 *   Adults present:                 none of the above.
 *
 * Returns null when nothing at all has been recorded, so callers can show
 * nothing rather than a misleading "Adults present".
 */
export function deriveBreedingTier(
  counts: StageCounts | null | undefined,
  adultTotal?: number | null,
): BreedingTier | null {
  const c = counts ?? {};

  if (positive(c.exuviae)) {
    return {
      label: 'Breeding confirmed',
      category: 'confirmed_breeder',
      evidence: 'Exuviae present — proof a specimen completed its life cycle here.',
    };
  }

  const probable = [
    positive(c.larvae) ? 'larvae' : null,
    positive(c.ovipositing_females) ? 'ovipositing females' : null,
    positive(c.emerging_adults) ? 'emerging adults' : null,
  ].filter(Boolean) as string[];
  if (probable.length > 0) {
    return {
      label: 'Breeding probable',
      category: 'probable_breeder',
      evidence: `Recorded ${probable.join(', ')} at a suitable water body.`,
    };
  }

  if (positive(c.copulating_pairs)) {
    return {
      label: 'Breeding possible',
      category: 'possible_breeder',
      evidence: 'Copulating pairs seen.',
    };
  }

  if (positive(adultTotal) || hasStageCounts(c)) {
    return {
      label: 'Adults present',
      category: 'non_breeding',
      evidence: 'No breeding evidence recorded.',
    };
  }

  return null;
}
