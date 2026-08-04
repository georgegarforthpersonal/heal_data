/**
 * Optional haptic tick for tap-to-count controls.
 *
 * Pure progressive enhancement. The Web Vibration API has never been supported
 * by Safari (desktop or iOS) and Firefox dropped it after 128, so on most
 * phones this does nothing at all. Every control that calls it must therefore
 * also give immediate visual confirmation — never rely on the buzz.
 */
export function tick(durationMs = 10): void {
  try {
    navigator.vibrate?.(durationMs);
  } catch {
    /* some browsers throw when vibration is blocked by policy */
  }
}
