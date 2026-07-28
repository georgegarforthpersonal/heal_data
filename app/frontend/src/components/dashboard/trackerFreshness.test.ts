import { describe, it, expect } from 'vitest';
import dayjs from 'dayjs';
import { freshness, QUIET_AFTER_DAYS, SILENT_AFTER_DAYS } from './trackerFreshness';

const NOW = dayjs('2026-07-28T20:00:00Z');
const daysAgo = (n: number) => NOW.subtract(n, 'day').toISOString();

describe('freshness', () => {
  it('returns null when a tag has never reported', () => {
    expect(freshness(null, NOW)).toBeNull();
    expect(freshness(undefined, NOW)).toBeNull();
    expect(freshness('', NOW)).toBeNull();
  });

  it('returns null for an unparseable timestamp rather than NaN days', () => {
    expect(freshness('not a date', NOW)).toBeNull();
  });

  it('treats a fix from today as current', () => {
    const f = freshness(daysAgo(0), NOW);
    expect(f).toMatchObject({ days: 0, level: 'current', label: 'Reporting' });
  });

  it('keeps a short gap current — tags routinely miss a day', () => {
    expect(freshness(daysAgo(QUIET_AFTER_DAYS - 1), NOW)?.level).toBe('current');
  });

  it('flags a tag as quiet at the lower threshold', () => {
    const f = freshness(daysAgo(QUIET_AFTER_DAYS), NOW);
    expect(f).toMatchObject({ days: QUIET_AFTER_DAYS, level: 'quiet', label: 'Silent 3 days' });
  });

  it('escalates to silent at the upper threshold', () => {
    const f = freshness(daysAgo(SILENT_AFTER_DAYS), NOW);
    expect(f).toMatchObject({ days: SILENT_AFTER_DAYS, level: 'silent', label: 'Silent 14 days' });
  });

  it('stays quiet just below the silent threshold', () => {
    expect(freshness(daysAgo(SILENT_AFTER_DAYS - 1), NOW)?.level).toBe('quiet');
  });

  it('reports the real age of a long-dead tag', () => {
    const f = freshness('2026-06-26T18:00:11Z', NOW);
    expect(f).toMatchObject({ days: 32, level: 'silent', label: 'Silent 32 days' });
  });

  it('clamps a future timestamp to zero instead of going negative', () => {
    const f = freshness(NOW.add(2, 'day').toISOString(), NOW);
    expect(f).toMatchObject({ days: 0, level: 'current' });
  });
});
