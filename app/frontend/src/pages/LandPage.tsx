import { Box, IconButton, Tooltip, Typography } from '@mui/material';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import { SPACING } from '../config/responsive';
import { PageTitle } from '../components/layout/PageTitle';
import { ImageCompare } from '../components/land/ImageCompare';
import { useMapFullscreen } from '../hooks';
import before2001 from '../assets/land/cannwood-2001.jpg';
import after2024 from '../assets/land/cannwood-2024.jpg';

/** width / height of the two (identically sized) comparison frames */
const ASPECT = 1496 / 508;

/**
 * Land: how the holding's land cover has changed over time. Cannwood-only
 * for now (the nav entry is gated, like GPS tracking) and static — a
 * pixel-aligned Google Earth before/after of the estate. The old frame is
 * the oldest sharp epoch: Google dates it "on or before 31 Dec 2001", but
 * it is the Getmapping millennium survey, flown leaf-on in summer
 * 1999–2001 (hence "c. 2000"). The new frame is 20 Jun 2024.
 */
export function LandPage() {
  // Same fullscreen treatment as the maps (Escape exits, body scroll locks).
  const { isFullscreen, toggleFullscreen, fullscreenContainerSx } = useMapFullscreen();

  return (
    <Box sx={{ p: SPACING.PAGE_PADDING }}>
      <PageTitle
        title="Land"
        subtitle="The same fields, about 24 years apart — drag the divider to compare"
      />
      <Box sx={{ maxWidth: 1100 }}>
        <Box
          sx={{
            position: 'relative',
            ...fullscreenContainerSx,
            ...(isFullscreen && {
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              p: 2,
            }),
          }}
        >
          {/* In fullscreen, cap the width so the fixed-aspect viewer also fits
              the viewport's height instead of overflowing it. */}
          <Box sx={{ width: '100%', ...(isFullscreen && { maxWidth: `calc(92vh * ${ASPECT})` }) }}>
            <ImageCompare
              beforeSrc={before2001}
              beforeAlt="Aerial imagery from around 2000: open grazed fields divided by hedgerows"
              beforeLabel="2000"
              afterSrc={after2024}
              afterAlt="Aerial imagery from June 2024: extensive scrub and young tree cover across former pasture"
              afterLabel="2024"
              aspectRatio={ASPECT}
            />
          </Box>
          {/* Bottom-right (not top-right like the maps) so it clears the
              year chips in the viewer's top corners. */}
          <Tooltip title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}>
            <IconButton
              size="small"
              aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
              onClick={toggleFullscreen}
              sx={{
                position: 'absolute',
                bottom: 10,
                right: 10,
                zIndex: 1000,
                bgcolor: 'white',
                boxShadow: 2,
                '&:hover': { bgcolor: 'grey.100' },
              }}
            >
              {isFullscreen ? <FullscreenExitIcon fontSize="small" /> : <FullscreenIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
        </Box>
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            gap: 1,
            mt: 1,
          }}
        >
          <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
            Left of the divider: 2000 · right: 2024
          </Typography>
          <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
            Imagery © Google Earth
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
