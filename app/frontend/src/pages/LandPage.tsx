import { Box, Typography } from '@mui/material';
import { SPACING } from '../config/responsive';
import { PageTitle } from '../components/layout/PageTitle';
import { ImageCompare } from '../components/land/ImageCompare';
import before2001 from '../assets/land/cannwood-2001.jpg';
import after2024 from '../assets/land/cannwood-2024.jpg';

/**
 * Land: how the holding's land cover has changed over time. Cannwood-only
 * for now (the nav entry is gated, like GPS tracking) and static — a
 * pixel-aligned Google Earth before/after of the estate. The old frame is
 * the oldest sharp epoch: Google dates it "on or before 31 Dec 2001", but
 * it is the Getmapping millennium survey, flown leaf-on in summer
 * 1999–2001 (hence "c. 2000"). The new frame is 20 Jun 2024.
 */
export function LandPage() {
  return (
    <Box sx={{ p: SPACING.PAGE_PADDING }}>
      <PageTitle
        title="Land"
        subtitle="The same fields, about 24 years apart — drag the divider to compare"
      />
      <Box sx={{ maxWidth: 1100 }}>
        <ImageCompare
          beforeSrc={before2001}
          beforeAlt="Aerial imagery from around 2000: open grazed fields divided by hedgerows"
          beforeLabel="C. 2000"
          afterSrc={after2024}
          afterAlt="Aerial imagery from June 2024: extensive scrub and young tree cover across former pasture"
          afterLabel="JUN 2024"
          aspectRatio={1496 / 508}
        />
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
            Left of the divider: summer, c. 1999–2001 · right: 20 Jun 2024
          </Typography>
          <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
            Imagery © Google Earth
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
