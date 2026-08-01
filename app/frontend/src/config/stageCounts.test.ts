/**
 * Tests for BDS life stage / behaviour counts and the derived breeding tier.
 */

import { describe, it, expect } from 'vitest';
import {
  deriveBreedingTier,
  hasStageCounts,
  pickStageCounts,
  recordsStageCounts,
  stageCountWarnings,
  STAGE_COUNT_FIELDS,
  STAGE_COUNT_KEYS,
} from './stageCounts';

describe('recordsStageCounts', () => {
  it('is on for dragonflies and damselflies', () => {
    expect(recordsStageCounts('dragonfly-damselfly')).toBe(true);
  });

  it('is off for other taxa', () => {
    expect(recordsStageCounts('bird')).toBe(false);
    expect(recordsStageCounts('butterfly')).toBe(false);
    expect(recordsStageCounts(null)).toBe(false);
    expect(recordsStageCounts(undefined)).toBe(false);
  });
});

describe('STAGE_COUNT_FIELDS', () => {
  it('lists the five BDS columns beyond the adult total, in form order', () => {
    expect(STAGE_COUNT_KEYS).toEqual([
      'copulating_pairs',
      'ovipositing_females',
      'larvae',
      'exuviae',
      'emerging_adults',
    ]);
  });

  it('states the one-pair-counts-as-one convention where it is entered', () => {
    const pairs = STAGE_COUNT_FIELDS.find((f) => f.key === 'copulating_pairs');
    expect(pairs?.helper).toMatch(/one pair counts as 1/i);
  });

  it('gives every category a distinct colour, never as the only cue', () => {
    const colours = STAGE_COUNT_FIELDS.map((f) => f.color);
    expect(new Set(colours).size).toBe(colours.length);
    // WCAG 1.4.1: a text label always accompanies the colour.
    expect(STAGE_COUNT_FIELDS.every((f) => f.label.trim().length > 0)).toBe(true);
  });
});

describe('stageCountWarnings', () => {
  it('flags an adult total smaller than the pairs imply', () => {
    // The case from the reported screenshot: 5 adults, 4 copulating pairs.
    const warnings = stageCountWarnings({ copulating_pairs: 4 }, 5);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('at least 8 adults');
  });

  it('accepts a total exactly equal to twice the pairs', () => {
    expect(stageCountWarnings({ copulating_pairs: 4 }, 8)).toEqual([]);
  });

  it('flags more ovipositing females than adults', () => {
    const warnings = stageCountWarnings({ ovipositing_females: 6 }, 2);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('ovipositing');
  });

  it('can report both inconsistencies at once', () => {
    expect(stageCountWarnings({ copulating_pairs: 3, ovipositing_females: 9 }, 4)).toHaveLength(2);
  });

  it('says nothing about larvae, exuviae or emerging adults', () => {
    // None of these are adults, so they carry no relationship to the total.
    expect(
      stageCountWarnings({ larvae: 90, exuviae: 120, emerging_adults: 40 }, 1),
    ).toEqual([]);
  });

  it('stays quiet when there is nothing to compare', () => {
    expect(stageCountWarnings({ copulating_pairs: 4 }, null)).toEqual([]);
    expect(stageCountWarnings({ copulating_pairs: 4 }, undefined)).toEqual([]);
    expect(stageCountWarnings(null, 5)).toEqual([]);
  });

  it('does not warn on recorded zeros', () => {
    expect(stageCountWarnings({ copulating_pairs: 0, ovipositing_females: 0 }, 0)).toEqual([]);
  });

  it('uses singular wording for one pair', () => {
    expect(stageCountWarnings({ copulating_pairs: 1 }, 1)[0]).toContain('1 copulating pair ');
  });
});

describe('pickStageCounts', () => {
  it('extracts only the stage fields, normalising missing ones to null', () => {
    expect(pickStageCounts({ copulating_pairs: 2, larvae: 0 })).toEqual({
      copulating_pairs: 2,
      ovipositing_females: null,
      larvae: 0,
      exuviae: null,
      emerging_adults: null,
    });
  });

  it('returns every key as null for nullish input', () => {
    // Must be all-null rather than {} so spreading the result clears stale
    // counts off a draft rather than leaving them in place.
    const cleared = {
      copulating_pairs: null,
      ovipositing_females: null,
      larvae: null,
      exuviae: null,
      emerging_adults: null,
    };
    expect(pickStageCounts(null)).toEqual(cleared);
    expect(pickStageCounts(undefined)).toEqual(cleared);
  });

  it('clears stale counts when spread over an existing draft', () => {
    const stale = { copulating_pairs: 4, larvae: 2, count: 7 };
    expect({ ...stale, ...pickStageCounts(null) }).toEqual({
      count: 7,
      copulating_pairs: null,
      ovipositing_females: null,
      larvae: null,
      exuviae: null,
      emerging_adults: null,
    });
  });
});

describe('hasStageCounts', () => {
  it('treats a recorded zero as recorded', () => {
    expect(hasStageCounts({ exuviae: 0 })).toBe(true);
  });

  it('is false when nothing was entered', () => {
    expect(hasStageCounts({})).toBe(false);
    expect(hasStageCounts({ larvae: null })).toBe(false);
    expect(hasStageCounts(null)).toBe(false);
  });
});

describe('deriveBreedingTier', () => {
  it('returns null when nothing has been recorded', () => {
    expect(deriveBreedingTier({}, null)).toBeNull();
    expect(deriveBreedingTier(null, 0)).toBeNull();
  });

  it('confirms breeding on exuviae — the only absolute proof', () => {
    const tier = deriveBreedingTier({ exuviae: 1 }, 0);
    expect(tier?.label).toBe('Breeding confirmed');
    expect(tier?.category).toBe('confirmed_breeder');
  });

  it('ranks exuviae above every other evidence type', () => {
    const tier = deriveBreedingTier(
      { exuviae: 1, larvae: 9, ovipositing_females: 3, copulating_pairs: 5 },
      20,
    );
    expect(tier?.category).toBe('confirmed_breeder');
  });

  it('treats larvae, ovipositing females and emerging adults as probable', () => {
    expect(deriveBreedingTier({ larvae: 3 }, 0)?.category).toBe('probable_breeder');
    expect(deriveBreedingTier({ ovipositing_females: 1 }, 0)?.category).toBe('probable_breeder');
    expect(deriveBreedingTier({ emerging_adults: 2 }, 0)?.category).toBe('probable_breeder');
  });

  it('names all the evidence that produced a probable verdict', () => {
    const tier = deriveBreedingTier({ larvae: 3, ovipositing_females: 1 }, 0);
    expect(tier?.evidence).toContain('larvae');
    expect(tier?.evidence).toContain('ovipositing females');
  });

  it('ranks probable evidence above copulating pairs', () => {
    const tier = deriveBreedingTier({ larvae: 1, copulating_pairs: 4 }, 10);
    expect(tier?.category).toBe('probable_breeder');
  });

  it('treats copulating pairs alone as possible breeding', () => {
    const tier = deriveBreedingTier({ copulating_pairs: 2 }, 6);
    expect(tier?.label).toBe('Breeding possible');
    expect(tier?.category).toBe('possible_breeder');
  });

  it('falls back to adults present when only a count was recorded', () => {
    const tier = deriveBreedingTier({}, 12);
    expect(tier?.label).toBe('Adults present');
    expect(tier?.category).toBe('non_breeding');
  });

  it('does not promote a recorded zero to breeding evidence', () => {
    const tier = deriveBreedingTier(
      { exuviae: 0, larvae: 0, ovipositing_females: 0, copulating_pairs: 0 },
      4,
    );
    expect(tier?.label).toBe('Adults present');
  });

  it('reports adults present when counts were zeroed but no adults seen', () => {
    // Searched and found nothing: still a meaningful record, not null.
    const tier = deriveBreedingTier({ exuviae: 0 }, 0);
    expect(tier?.label).toBe('Adults present');
  });
});
