/**
 * Tests for BDS life stage / behaviour counts.
 */

import { describe, it, expect } from 'vitest';
import {
  hasPositiveStageCounts,
  hasStageCounts,
  pickStageCounts,
  recordsStageCounts,
  stageCountCap,
  stageCountErrors,
  summariseStageCounts,
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
});

describe('stageCountCap', () => {
  it('caps pairs at half the adult total, rounded down', () => {
    expect(stageCountCap('copulating_pairs', 5)?.max).toBe(2);
    expect(stageCountCap('copulating_pairs', 1)?.max).toBe(0);
  });

  it('caps ovipositing females at the adult total', () => {
    expect(stageCountCap('ovipositing_females', 3)?.max).toBe(3);
  });

  it('leaves non-adult stages uncapped', () => {
    expect(stageCountCap('larvae', 1)).toBeNull();
    expect(stageCountCap('exuviae', 1)).toBeNull();
    expect(stageCountCap('emerging_adults', 1)).toBeNull();
  });

  it('has no cap without a known adult total', () => {
    expect(stageCountCap('copulating_pairs', null)).toBeNull();
    expect(stageCountCap('ovipositing_females', undefined)).toBeNull();
  });
});

describe('stageCountErrors', () => {
  it('rejects an adult total smaller than the pairs imply', () => {
    // The original screenshot case: 5 adults, 4 copulating pairs.
    const errors = stageCountErrors({ copulating_pairs: 4 }, 5);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("Copulating pairs can't be 4");
    expect(errors[0]).toContain('raise Adults (total)');
  });

  it('accepts a total exactly equal to twice the pairs', () => {
    expect(stageCountErrors({ copulating_pairs: 4 }, 8)).toEqual([]);
  });

  it('rejects more ovipositing females than adults', () => {
    const errors = stageCountErrors({ ovipositing_females: 2 }, 1);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("Ovipositing females can't be 2");
  });

  it('can report both violations at once', () => {
    expect(stageCountErrors({ copulating_pairs: 3, ovipositing_females: 9 }, 4)).toHaveLength(2);
  });

  it('says nothing about larvae, exuviae or emerging adults', () => {
    // None of these are adults, so they carry no relationship to the total.
    expect(
      stageCountErrors({ larvae: 90, exuviae: 120, emerging_adults: 40 }, 1),
    ).toEqual([]);
  });

  it('stays quiet when there is nothing to compare', () => {
    expect(stageCountErrors({ copulating_pairs: 4 }, null)).toEqual([]);
    expect(stageCountErrors({ copulating_pairs: 4 }, undefined)).toEqual([]);
    expect(stageCountErrors(null, 5)).toEqual([]);
  });

  it('does not flag recorded zeros', () => {
    expect(stageCountErrors({ copulating_pairs: 0, ovipositing_females: 0 }, 0)).toEqual([]);
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

describe('hasPositiveStageCounts', () => {
  it('needs a value above zero, not just a recorded zero', () => {
    expect(hasPositiveStageCounts({ larvae: 0, exuviae: 0 })).toBe(false);
    expect(hasPositiveStageCounts({ larvae: 0, exuviae: 1 })).toBe(true);
  });

  it('is false for nothing recorded', () => {
    expect(hasPositiveStageCounts({})).toBe(false);
    expect(hasPositiveStageCounts(null)).toBe(false);
  });
});

describe('summariseStageCounts', () => {
  it('uses singular forms at one, plural otherwise', () => {
    expect(summariseStageCounts({ ovipositing_females: 1 })).toBe('1 ovipositing female');
    expect(summariseStageCounts({ larvae: 1 })).toBe('1 larva');
    expect(summariseStageCounts({ exuviae: 1 })).toBe('1 exuvia');
    expect(summariseStageCounts({ copulating_pairs: 2, ovipositing_females: 3 })).toBe(
      '2 copulating pairs, 3 ovipositing females',
    );
  });

  it('has nothing to say for zeros or nothing recorded — they read the same', () => {
    expect(summariseStageCounts({ larvae: 0 })).toBeNull();
    expect(summariseStageCounts({})).toBeNull();
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

