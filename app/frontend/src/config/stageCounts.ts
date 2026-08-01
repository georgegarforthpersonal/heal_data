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
 * code; BDS asks for raw counts — and the raw counts are all we show; no
 * derived proof-of-breeding verdict (cut on George's ask, Aug 2026).
 *
 * Sources:
 *   BDS Odonata Recording Form (9/11/22)
 *   BDS Proof of Breeding Criteria v4 (20/11/21)
 */


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
  /** Singular form for summary lines ("1 copulating pair", "1 larva"). */
  singular: string;
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
    singular: 'copulating pair',
    helper: 'In tandem or the wheel. One pair counts as 1.',
    color: 'purple',
  },
  { key: 'ovipositing_females', label: 'Ovipositing females', singular: 'ovipositing female', color: 'pink' },
  { key: 'larvae', label: 'Larvae', singular: 'larva', color: 'blue' },
  {
    key: 'exuviae',
    label: 'Exuviae',
    singular: 'exuvia',
    helper: 'Cast larval skins — proof of successful breeding.',
    color: 'green',
  },
  {
    key: 'emerging_adults',
    label: 'Emerging adults',
    singular: 'emerging adult',
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
 * True when any stage count is above zero. With positive breeding evidence a
 * record stands on its own even at 0 adults — a visit can find only exuviae
 * or larvae, and BDS wants that recorded honestly rather than padded with a
 * phantom adult.
 */
export function hasPositiveStageCounts(counts: StageCounts | null | undefined): boolean {
  if (!counts) return false;
  return STAGE_COUNT_KEYS.some((key) => (counts[key] ?? 0) > 0);
}

/**
 * The hard cap a count field inherits from the adult total, or null when the
 * field is unbounded or the total isn't known. Only arithmetic that is true
 * by definition caps anything: a copulating pair is two adults and an
 * ovipositing female is one adult, and Adults (total) is asked to include
 * both. Larvae, exuviae and emerging adults are not adults, so they carry no
 * such relationship — anything merely implausible (90 larvae) stays
 * unchecked, per the eBird flag-don't-block philosophy.
 */
export function stageCountCap(
  key: StageCountKey,
  adultTotal: number | null | undefined,
): { max: number; reason: string } | null {
  if (typeof adultTotal !== 'number') return null;
  if (key === 'copulating_pairs') {
    return {
      max: Math.floor(adultTotal / 2),
      reason: `a pair is 2 adults and Adults (total) is ${adultTotal}`,
    };
  }
  if (key === 'ovipositing_females') {
    return {
      max: adultTotal,
      reason: `an ovipositing female is 1 adult and Adults (total) is ${adultTotal}`,
    };
  }
  return null;
}

/**
 * Cross-field errors: a recorded count above its cap. These BLOCK saving —
 * the arithmetic is impossible by definition, and each message says which
 * field to fix, so the wall points at the correction rather than inviting a
 * made-up number. (Tally mode can't even reach this state — the + stops at
 * the cap — so it only arises from typed entry or lowering the total after
 * counts were recorded.)
 */
export function stageCountErrors(
  counts: StageCounts | null | undefined,
  adultTotal: number | null | undefined,
): string[] {
  const c = counts ?? {};
  const errors: string[] = [];
  for (const field of STAGE_COUNT_FIELDS) {
    const cap = stageCountCap(field.key, adultTotal);
    const recorded = c[field.key];
    if (cap && typeof recorded === 'number' && recorded > cap.max) {
      errors.push(
        `${field.label} can't be ${recorded}: ${cap.reason}. ` +
          `Lower it, or raise Adults (total) if you saw more.`,
      );
    }
  }
  return errors;
}

/**
 * One line listing the positive counts, for the collapsed panel header and
 * read-only summaries. Returns null when nothing positive was recorded — the
 * UI treats zero and unrecorded as the same thing (George's call, Aug 2026),
 * so an all-zero record has nothing to say.
 */
export function summariseStageCounts(counts: StageCounts | null | undefined): string | null {
  const c = counts ?? {};
  const seen = STAGE_COUNT_FIELDS.filter((f) => {
    const value = c[f.key];
    return typeof value === 'number' && value > 0;
  });

  if (seen.length === 0) return null;
  return seen
    .map((f) => `${c[f.key]} ${c[f.key] === 1 ? f.singular : f.label.toLowerCase()}`)
    .join(', ');
}

// The derived BDS proof-of-breeding tier ("Breeding possible/probable/
// confirmed") was cut on George's ask, 1 Aug 2026 — the raw counts are the
// record; no derived verdict is shown anywhere.
