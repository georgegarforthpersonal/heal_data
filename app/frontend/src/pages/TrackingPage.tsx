import { Box } from '@mui/material';
import { DeviceTrackerMap } from '../components/dashboard/DeviceTrackerMap';
import { SPACING } from '../config/responsive';
import { PageTitle } from '../components/layout/PageTitle';

/**
 * GPS tracking: live/recent tracker positions. Its own page (it used to be a
 * tab on the species dashboard, which made that page's name a lie); the nav
 * entry is gated to orgs that have trackers.
 */
export function TrackingPage() {
  return (
    <Box sx={{ p: SPACING.PAGE_PADDING }}>
      <PageTitle title="GPS tracking" />
      <DeviceTrackerMap />
    </Box>
  );
}
