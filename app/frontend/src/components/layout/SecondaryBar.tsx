import { Box, Typography, Breadcrumbs, Link, Stack } from '@mui/material';
import { ArrowBack } from '@mui/icons-material';
import { type ReactNode } from 'react';

interface BreadcrumbItem {
  label: string;
  onClick?: () => void;
}

interface SecondaryBarProps {
  pageTitle: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: ReactNode; // Optional action buttons (e.g., New, Edit, Delete)
}

/**
 * SecondaryBar - Secondary navigation bar for page title and breadcrumbs
 *
 * Features:
 * - Page title display
 * - Optional breadcrumb navigation
 * - Optional action buttons (right-aligned)
 * - Responsive design
 */
export function SecondaryBar({ pageTitle, breadcrumbs, actions }: SecondaryBarProps) {
  return (
    <Box
      sx={{
        borderBottom: '1px solid',
        borderColor: 'divider',
        bgcolor: 'white',
        px: { xs: 2, sm: 3, md: 4 },
        py: { xs: 1.5, sm: 2 },
      }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          {/* Breadcrumbs (if provided) */}
          {breadcrumbs && breadcrumbs.length > 0 && (
            <Breadcrumbs
              sx={{
                mb: 0.5,
                fontSize: { xs: '0.75rem', sm: '0.875rem' },
                '& .MuiBreadcrumbs-separator': {
                  mx: { xs: 0.5, sm: 1 }
                }
              }}
            >
              {breadcrumbs.map((crumb, index) => (
                crumb.onClick ? (
                  <Link
                    key={index}
                    component="button"
                    onClick={crumb.onClick}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                      textDecoration: 'none',
                      color: 'text.secondary',
                      cursor: 'pointer',
                      fontSize: 'inherit',
                      '&:hover': { color: 'primary.main' }
                    }}
                  >
                    {index === 0 && <ArrowBack sx={{ fontSize: { xs: 14, sm: 16 } }} />}
                    {crumb.label}
                  </Link>
                ) : (
                  <Typography key={index} color="text.primary" sx={{ fontSize: 'inherit' }}>
                    {crumb.label}
                  </Typography>
                )
              ))}
            </Breadcrumbs>
          )}

          {/* Page Title */}
          <Typography
            variant="h1"
            sx={{
              fontSize: { xs: '1.25rem', sm: '1.5rem' },
              fontWeight: 600,
              color: 'text.primary',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {pageTitle}
          </Typography>
        </Box>

        {/* Action Buttons (right side) */}
        {actions && (
          <Box sx={{ flexShrink: 0 }}>
            {actions}
          </Box>
        )}
      </Stack>
    </Box>
  );
}
