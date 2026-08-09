import dayjs, { Dayjs } from 'dayjs';

/**
 * Time-window filtering for the GPS tracker map. The window applies to data
 * already loaded (the device list's latest fixes and the selected bird's
 * track), so switching windows is instant — no refetch.
 */

export interface TrackWindowOption {
  /** ToggleButtonGroup value (MUI reserves null for "nothing selected"). */
  key: string;
  /** Window length counting back from now; null = no filter (all data). */
  days: number | null;
  /** Compact button label. */
  label: string;
  /** Human phrase for notices, e.g. "no fixes in the last 3 days". */
  noun: string;
}

export const TRACK_WINDOW_OPTIONS: TrackWindowOption[] = [
  { key: '1', days: 1, label: '24h', noun: 'the last 24 hours' },
  { key: '3', days: 3, label: '3d', noun: 'the last 3 days' },
  { key: '7', days: 7, label: '7d', noun: 'the last 7 days' },
  { key: '30', days: 30, label: '30d', noun: 'the last 30 days' },
  { key: 'all', days: null, label: 'All', noun: 'the whole programme' },
];

export const DEFAULT_WINDOW_KEY = 'all';

export function windowOption(key: string): TrackWindowOption {
  return TRACK_WINDOW_OPTIONS.find((o) => o.key === key) ?? TRACK_WINDOW_OPTIONS[TRACK_WINDOW_OPTIONS.length - 1];
}

/** Start of the window, or null when no filter applies. */
export function windowStartFor(days: number | null, now: Dayjs = dayjs()): Dayjs | null {
  return days == null ? null : now.subtract(days, 'day');
}

/**
 * Whether a device's latest fix falls inside the window. With no window every
 * device counts as current; with one, a device with no fix at all does not.
 */
export function hasFixInWindow(gpsTimestamp: string | null, windowStart: Dayjs | null): boolean {
  if (windowStart == null) return true;
  return gpsTimestamp != null && !dayjs(gpsTimestamp).isBefore(windowStart);
}

/** The fixes of a track that fall inside the window (track order preserved). */
export function filterTrackToWindow<T extends { timestamp: string }>(
  track: T[],
  windowStart: Dayjs | null,
): T[] {
  if (windowStart == null) return track;
  return track.filter((f) => !dayjs(f.timestamp).isBefore(windowStart));
}
