import { useEffect } from 'react';

/**
 * Keep the screen awake while `active` — the same behaviour as navigation
 * and fitness apps mid-activity. In the field the phone otherwise dims and
 * locks mid-transect, and every unlock is a re-orient (and a chance for the
 * OS to kill the tab).
 *
 * Uses the Screen Wake Lock API (iOS Safari 16.4+, Chrome 84+). The OS
 * releases the lock whenever the page is hidden, so it is re-requested when
 * the app returns to the foreground. Silently does nothing where
 * unsupported or denied (e.g. low-battery mode) — it is an assist, not a
 * requirement.
 */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return;

    let lock: WakeLockSentinel | null = null;
    let cancelled = false;

    const acquire = async () => {
      try {
        lock = await navigator.wakeLock.request('screen');
        if (cancelled) await lock.release();
      } catch {
        // Denied (battery saver) or unavailable — nothing to do.
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') acquire();
    };

    acquire();
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibilityChange);
      lock?.release().catch(() => {});
    };
  }, [active]);
}
