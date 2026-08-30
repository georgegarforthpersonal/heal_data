import { useRef, useState } from 'react';
import { Box } from '@mui/material';

/**
 * Before/after image comparison: two pixel-aligned images of the same extent,
 * with a draggable vertical divider revealing one or the other. The top
 * (before) layer is clipped with clip-path so both images stay full-size and
 * never reflow while dragging.
 *
 * Interaction: pointer drag anywhere on the image, arrow keys / Home / End
 * when focused. The whole viewer is the slider control (role="slider").
 */
export function ImageCompare({
  beforeSrc,
  beforeAlt,
  beforeLabel,
  afterSrc,
  afterAlt,
  afterLabel,
  aspectRatio,
}: {
  beforeSrc: string;
  beforeAlt: string;
  beforeLabel: string;
  afterSrc: string;
  afterAlt: string;
  afterLabel: string;
  /** width / height of the (identically sized) images, e.g. 1496 / 508 */
  aspectRatio: number;
}) {
  const viewerRef = useRef<HTMLDivElement>(null);
  const [split, setSplit] = useState(50);

  const clampSplit = (pct: number) => Math.max(0, Math.min(100, pct));

  const splitFromPointer = (clientX: number) => {
    const rect = viewerRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    setSplit(clampSplit(((clientX - rect.left) / rect.width) * 100));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') setSplit((s) => clampSplit(s - 2));
    else if (e.key === 'ArrowRight') setSplit((s) => clampSplit(s + 2));
    else if (e.key === 'Home') setSplit(0);
    else if (e.key === 'End') setSplit(100);
    else return;
    e.preventDefault();
  };

  const labelChip = {
    position: 'absolute',
    top: 10,
    px: 1.25,
    py: 0.25,
    borderRadius: 99,
    bgcolor: 'rgba(20, 24, 19, 0.72)',
    color: '#fff',
    fontSize: 12,
    letterSpacing: '0.06em',
    pointerEvents: 'none',
  } as const;

  return (
    <Box
      ref={viewerRef}
      role="slider"
      tabIndex={0}
      aria-label={`Image comparison: ${beforeLabel} versus ${afterLabel}`}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(split)}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        splitFromPointer(e.clientX);
      }}
      onPointerMove={(e) => {
        if (e.buttons) splitFromPointer(e.clientX);
      }}
      onKeyDown={handleKeyDown}
      sx={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 1,
        border: '1px solid',
        borderColor: 'divider',
        aspectRatio: String(aspectRatio),
        userSelect: 'none',
        // pan-y: horizontal drags drive the divider, vertical swipes still
        // scroll the page (the viewer spans the full width on mobile).
        touchAction: 'pan-y',
        cursor: 'ew-resize',
        '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 },
      }}
    >
      <Box
        component="img"
        src={afterSrc}
        alt={afterAlt}
        draggable={false}
        sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }}
      />
      <Box
        component="img"
        src={beforeSrc}
        alt={beforeAlt}
        draggable={false}
        sx={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          display: 'block',
          clipPath: `inset(0 ${100 - split}% 0 0)`,
        }}
      />
      {/* Divider line + round handle, purely decorative (the viewer is the control) */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: `${split}%`,
          width: 2,
          ml: '-1px',
          bgcolor: '#fff',
          boxShadow: '0 0 0 1px rgba(20, 24, 19, 0.35)',
          pointerEvents: 'none',
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          top: '50%',
          left: `${split}%`,
          transform: 'translate(-50%, -50%)',
          width: 36,
          height: 36,
          borderRadius: '50%',
          bgcolor: '#fff',
          boxShadow: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '3px',
          pointerEvents: 'none',
          // Left/right arrowheads drawn with borders
          '&::before, &::after': { content: '""', borderTop: '5px solid transparent', borderBottom: '5px solid transparent' },
          '&::before': { borderRight: '6px solid #20261f' },
          '&::after': { borderLeft: '6px solid #20261f' },
        }}
      />
      <Box sx={{ ...labelChip, left: 12 }}>{beforeLabel}</Box>
      <Box sx={{ ...labelChip, right: 12 }}>{afterLabel}</Box>
    </Box>
  );
}
