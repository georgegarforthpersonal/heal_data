import { describe, it, expect } from 'vitest';
import dayjs from 'dayjs';
import {
  TRACK_WINDOW_OPTIONS,
  DEFAULT_WINDOW_KEY,
  windowOption,
  windowStartFor,
  hasFixInWindow,
  filterTrackToWindow,
} from './trackerTimeWindow';

const NOW = dayjs('2026-08-09T12:00:00Z');

describe('windowStartFor', () => {
  it('returns null for the no-filter option', () => {
    expect(windowStartFor(null, NOW)).toBeNull();
  });

  it('counts back from now', () => {
    expect(windowStartFor(3, NOW)?.toISOString()).toBe('2026-08-06T12:00:00.000Z');
  });
});

describe('windowOption', () => {
  it('resolves each option by key', () => {
    for (const opt of TRACK_WINDOW_OPTIONS) {
      expect(windowOption(opt.key)).toBe(opt);
    }
  });

  it('falls back to the all-time option for an unknown key', () => {
    expect(windowOption('nonsense').days).toBeNull();
  });

  it('defaults to no filter', () => {
    expect(windowOption(DEFAULT_WINDOW_KEY).days).toBeNull();
  });
});

describe('hasFixInWindow', () => {
  const start = windowStartFor(3, NOW);

  it('is always true with no window', () => {
    expect(hasFixInWindow(null, null)).toBe(true);
    expect(hasFixInWindow('2026-01-01T00:00:00Z', null)).toBe(true);
  });

  it('accepts a fix inside the window, including exactly at the boundary', () => {
    expect(hasFixInWindow('2026-08-08T09:00:00Z', start)).toBe(true);
    expect(hasFixInWindow('2026-08-06T12:00:00Z', start)).toBe(true);
  });

  it('rejects a fix before the window or a device with no fix', () => {
    expect(hasFixInWindow('2026-08-06T11:59:59Z', start)).toBe(false);
    expect(hasFixInWindow(null, start)).toBe(false);
  });
});

describe('filterTrackToWindow', () => {
  const fix = (timestamp: string) => ({ timestamp });
  const track = [fix('2026-08-01T00:00:00Z'), fix('2026-08-07T08:00:00Z'), fix('2026-08-09T06:00:00Z')];

  it('passes the whole track through with no window', () => {
    expect(filterTrackToWindow(track, null)).toEqual(track);
  });

  it('keeps only in-window fixes, preserving order', () => {
    expect(filterTrackToWindow(track, windowStartFor(3, NOW))).toEqual([
      fix('2026-08-07T08:00:00Z'),
      fix('2026-08-09T06:00:00Z'),
    ]);
  });

  it('returns empty when nothing falls in the window', () => {
    expect(filterTrackToWindow(track, windowStartFor(1, dayjs('2026-09-01T00:00:00Z')))).toEqual([]);
  });
});
