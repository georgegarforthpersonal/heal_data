/**
 * Loading placeholder for a group panel: the panel's chrome (card, header
 * bar) at roughly its final size, with shimmer rows — so the page's layout
 * is stable from first paint and panels hydrate in place instead of the
 * whole page hiding behind one spinner.
 */
import { Box, Paper, Skeleton } from '@mui/material';
import { groupCardSx, groupColors } from '../../pages/groups/groupsTokens';

interface PanelSkeletonProps {
  /** Header title width in px (mimics the real title's length). */
  titleWidth?: number;
  /** Number of shimmer rows under the header. */
  rows?: number;
  /** A single tall block (chart/map) instead of rows. */
  blockHeight?: number;
}

export default function PanelSkeleton({ titleWidth = 80, rows = 3, blockHeight }: PanelSkeletonProps) {
  return (
    <Paper sx={groupCardSx} aria-hidden>
      <Box sx={{ px: 2.25, py: 1.75, borderBottom: `1px solid ${groupColors.divider}` }}>
        <Skeleton variant="text" width={titleWidth} sx={{ fontSize: 15 }} />
      </Box>
      {blockHeight != null ? (
        <Box sx={{ p: 2.25 }}>
          <Skeleton variant="rounded" height={blockHeight} />
        </Box>
      ) : (
        Array.from({ length: rows }, (_, i) => (
          <Box
            key={i}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              px: 2.25,
              py: 1.6,
              borderTop: i === 0 ? 'none' : `1px solid ${groupColors.dividerInner}`,
            }}
          >
            <Box sx={{ flex: 1 }}>
              <Skeleton variant="text" width="45%" sx={{ fontSize: 14.5 }} />
              <Skeleton variant="text" width="28%" sx={{ fontSize: 12 }} />
            </Box>
            <Skeleton variant="circular" width={28} height={28} />
          </Box>
        ))
      )}
    </Paper>
  );
}
