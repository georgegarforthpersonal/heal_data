import { useState, useCallback, useEffect } from 'react';
import { useMap } from 'react-leaflet';
import type { SxProps, Theme } from '@mui/material';
import { Z_INDEX } from '../config/responsive';

/**
 * Hook to manage fullscreen state for map components.
 *
 * Returns sx props to merge onto the Paper container and the map Box,
 * plus a toggle callback and the current state.
 */
export function useMapFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => !prev);
  }, []);

  // Escape key exits fullscreen
  useEffect(() => {
    if (!isFullscreen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Swallow the event in the capture phase so it never reaches an
        // enclosing MUI Dialog (which would otherwise close and discard
        // the user's in-progress form).
        e.stopPropagation();
        e.preventDefault();
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isFullscreen]);

  // Lock body scroll while fullscreen
  useEffect(() => {
    if (isFullscreen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isFullscreen]);

  // iOS keyboard guard: mobile Safari ignores body overflow and scrolls the
  // layout viewport to reveal a focused input (e.g. the species field in a
  // map popup), dragging the fixed fullscreen container — and its exit
  // button — off screen, sometimes leaving it there after the keyboard
  // closes. While fullscreen, pin the window back to the origin whenever the
  // visual viewport shifts.
  useEffect(() => {
    if (!isFullscreen) return;
    window.scrollTo(0, 0);

    let frame: number | null = null;
    const repin = () => {
      if (frame !== null) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        if (window.scrollX !== 0 || window.scrollY !== 0) {
          window.scrollTo(0, 0);
        }
      });
    };

    const vv = window.visualViewport;
    vv?.addEventListener('resize', repin);
    vv?.addEventListener('scroll', repin);
    window.addEventListener('scroll', repin);
    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      vv?.removeEventListener('resize', repin);
      vv?.removeEventListener('scroll', repin);
      window.removeEventListener('scroll', repin);
    };
  }, [isFullscreen]);

  const fullscreenContainerSx: SxProps<Theme> = isFullscreen
    ? {
        position: 'fixed',
        inset: 0,
        zIndex: Z_INDEX.FULLSCREEN,
        borderRadius: 0,
        border: 'none',
        bgcolor: 'white',
      }
    : {};

  const fullscreenMapSx: SxProps<Theme> = isFullscreen
    ? { height: '100%' }
    : {};

  return {
    isFullscreen,
    toggleFullscreen,
    fullscreenContainerSx,
    fullscreenMapSx,
  } as const;
}

/**
 * react-leaflet child component that calls `map.invalidateSize()`
 * whenever the fullscreen state changes, so tiles re-render correctly.
 */
export function MapResizeHandler({ isFullscreen }: { isFullscreen: boolean }) {
  const map = useMap();

  useEffect(() => {
    // Small delay to let the CSS transition finish
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 300);
    return () => clearTimeout(timer);
  }, [isFullscreen, map]);

  // While fullscreen, the soft keyboard resizes the visual viewport around
  // the fixed container; without an invalidate Leaflet keeps stale tile
  // maths and the map appears oddly zoomed/shifted once the keyboard goes.
  useEffect(() => {
    if (!isFullscreen) return;
    const vv = window.visualViewport;
    if (!vv) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onResize = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => map.invalidateSize(), 150);
    };
    vv.addEventListener('resize', onResize);
    return () => {
      if (timer) clearTimeout(timer);
      vv.removeEventListener('resize', onResize);
    };
  }, [isFullscreen, map]);

  return null;
}
