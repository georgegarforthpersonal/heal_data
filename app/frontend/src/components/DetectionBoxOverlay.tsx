import { Box } from '@mui/material';
import type { FilterDetection } from '../services/api';

const CATEGORY_COLORS: Record<string, string> = {
  animal: '#f44336',
  person: '#ff9800',
  vehicle: '#2196f3',
};

interface DetectionBoxOverlayProps {
  detections: FilterDetection[];
}

export function DetectionBoxOverlay({ detections }: DetectionBoxOverlayProps) {
  return (
    <>
      {detections.map((det, i) => {
        const color = CATEGORY_COLORS[det.category] ?? '#2196f3';
        return (
          <Box
            key={i}
            sx={{
              position: 'absolute',
              left: `${det.x * 100}%`,
              top: `${det.y * 100}%`,
              width: `${det.w * 100}%`,
              height: `${det.h * 100}%`,
              border: '2.5px solid',
              borderColor: color,
              pointerEvents: 'none',
              '&::after': {
                content: `"${det.category} ${(det.confidence * 100).toFixed(0)}%"`,
                position: 'absolute',
                top: -18,
                left: -2,
                bgcolor: color,
                color: 'white',
                fontSize: '0.65rem',
                fontWeight: 600,
                px: 0.5,
                py: 0.1,
                borderRadius: '2px 2px 0 0',
                whiteSpace: 'nowrap',
              },
            }}
          />
        );
      })}
    </>
  );
}
