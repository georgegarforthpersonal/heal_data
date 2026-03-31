import { useState, type ReactNode } from 'react';
import { Box, Button, type SxProps, type Theme } from '@mui/material';

export interface ThumbnailGridItem {
  key: string | number;
  src: string;
  alt?: string;
}

interface ThumbnailGridProps {
  items: ThumbnailGridItem[];
  /** Max items shown before "Show all" appears. 0 = no limit. Default 28. */
  previewLimit?: number;
  /** Called when a thumbnail is clicked, with the index into `items` */
  onClickItem?: (index: number) => void;
  /** Render optional overlay content absolutely positioned over a thumbnail */
  renderOverlay?: (index: number) => ReactNode;
  /** Return custom sx for a specific thumbnail's wrapper Box */
  getItemSx?: (index: number) => SxProps<Theme>;
}

const THUMBNAIL_HEIGHT = 100;

export function ThumbnailGrid({
  items,
  previewLimit = 28,
  onClickItem,
  renderOverlay,
  getItemSx,
}: ThumbnailGridProps) {
  const [expanded, setExpanded] = useState(false);

  const hasLimit = previewLimit > 0 && items.length > previewLimit;
  const visibleItems = hasLimit && !expanded ? items.slice(0, previewLimit) : items;

  return (
    <>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
          gap: 1,
        }}
      >
        {visibleItems.map((item, idx) => (
          <Box
            key={item.key}
            onClick={onClickItem ? () => onClickItem(idx) : undefined}
            sx={{
              position: 'relative',
              cursor: onClickItem ? 'pointer' : 'default',
              borderRadius: 1,
              overflow: 'hidden',
              border: '2px solid transparent',
              '&:hover': onClickItem ? { opacity: 0.8 } : undefined,
              ...((getItemSx?.(idx) ?? {}) as Record<string, unknown>),
            }}
          >
            <img
              src={item.src}
              alt={item.alt ?? ''}
              loading="lazy"
              style={{
                width: '100%',
                height: THUMBNAIL_HEIGHT,
                objectFit: 'cover',
                display: 'block',
              }}
            />
            {renderOverlay?.(idx)}
          </Box>
        ))}
      </Box>
      {hasLimit && (
        <Button
          size="small"
          onClick={() => setExpanded((prev) => !prev)}
          sx={{ textTransform: 'none', mt: 0.5, fontSize: '0.75rem' }}
        >
          {expanded ? 'Show less' : `Show all ${items.length} images`}
        </Button>
      )}
    </>
  );
}
