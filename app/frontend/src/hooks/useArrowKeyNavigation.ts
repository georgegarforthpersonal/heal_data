import { useEffect, useCallback } from 'react';

interface ArrowKeyNavigationOptions {
  enabled: boolean;
  onNext: () => void;
  onPrev: () => void;
  onEscape?: () => void;
  /** When true, arrow events are suppressed if the target is an input/textarea */
  ignoreInputs?: boolean;
  /** Optional predicate — return false to suppress arrow handling for this event */
  shouldHandle?: (e: KeyboardEvent) => boolean;
}

/**
 * Registers left/right arrow key navigation on the window.
 * Cleans up automatically when `enabled` is false or on unmount.
 */
export function useArrowKeyNavigation({
  enabled,
  onNext,
  onPrev,
  onEscape,
  ignoreInputs = true,
  shouldHandle,
}: ArrowKeyNavigationOptions) {
  const handler = useCallback(
    (e: KeyboardEvent) => {
      if (ignoreInputs && (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        return;
      }
      if (shouldHandle && !shouldHandle(e)) return;

      if (e.key === 'ArrowRight') { e.preventDefault(); onNext(); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); onPrev(); }
      if (e.key === 'Escape' && onEscape) { e.preventDefault(); onEscape(); }
    },
    [onNext, onPrev, onEscape, ignoreInputs, shouldHandle],
  );

  useEffect(() => {
    if (!enabled) return;
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [enabled, handler]);
}
