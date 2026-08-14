/**
 * Lightweight breadcrumb for Group screens, e.g. "Surveys / Butterfly".
 * A real <nav> of real links — middle-click/cmd-click open in a new tab —
 * with the last crumb as plain muted text and decorative separators hidden
 * from assistive tech.
 */
import { Box, Link, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { groupColors } from '../../pages/groups/groupsTokens';

export interface Crumb {
  label: string;
  to?: string;
}

export default function GroupBreadcrumb({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <Box
      component="nav"
      aria-label="Breadcrumb"
      sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 2, flexWrap: 'wrap' }}
    >
      {crumbs.map((c, i) => {
        const isLast = i === crumbs.length - 1;
        return (
          <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            {c.to && !isLast ? (
              <Link
                component={RouterLink}
                to={c.to}
                underline="hover"
                sx={{ fontSize: 13.5, color: groupColors.brandDark, fontWeight: 500 }}
              >
                {c.label}
              </Link>
            ) : (
              <Typography
                aria-current={isLast ? 'page' : undefined}
                sx={{ fontSize: 13.5, color: groupColors.textMuted }}
              >
                {c.label}
              </Typography>
            )}
            {!isLast && (
              <Typography aria-hidden sx={{ fontSize: 13.5, color: '#ccc' }}>
                /
              </Typography>
            )}
          </Box>
        );
      })}
    </Box>
  );
}
