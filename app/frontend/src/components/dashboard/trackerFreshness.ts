import dayjs from 'dayjs';

// A tracker pin shows where a tag last reported, which is not the same as where
// the bird is now: a tag that stops uplinking leaves its final position on the
// map indefinitely. These thresholds turn that age into something visible.
//
// Tags routinely miss a day or two — post-release gaps of up to six days have
// been seen on tags that then resumed — so a short silence is normal and only
// worth a quiet note. Past a fortnight the position is stale enough that it
// should not be read as a live bird without checking.
export const QUIET_AFTER_DAYS = 3;
export const SILENT_AFTER_DAYS = 14;

export type FreshnessLevel = 'current' | 'quiet' | 'silent';

export interface Freshness {
  days: number;
  level: FreshnessLevel;
  /** Short form for a chip or badge, e.g. "Silent 25 days". */
  label: string;
}

/** Age of a tag's last fix, or null when it has never reported. */
export function freshness(timestamp: string | null | undefined, now = dayjs()): Freshness | null {
  if (!timestamp) return null;
  const then = dayjs(timestamp);
  if (!then.isValid()) return null;
  // Clamp so a tag whose clock runs slightly ahead of ours never reads as negative.
  const days = Math.max(0, now.diff(then, 'day'));
  const level: FreshnessLevel =
    days >= SILENT_AFTER_DAYS ? 'silent' : days >= QUIET_AFTER_DAYS ? 'quiet' : 'current';
  return {
    days,
    level,
    label: level === 'current' ? 'Reporting' : `Silent ${days} days`,
  };
}
