import { type ReactNode } from 'react';
import { Box, Stack, Link, Typography } from '@mui/material';
import { ArrowBack } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useResponsive } from '../../hooks/useResponsive';
import { displayFontFamily } from '../../theme';

interface PageHeaderProps {
  /**
   * Page title, in the display face. On mobile (no back link) it is the only
   * answer to "where am I?", so pass one on any page reachable by deep link.
   */
  title?: string;

  /**
   * Configuration for the back button
   */
  backButton?: {
    /**
     * Text to display on the back button
     * @default "Back to Surveys"
     */
    label?: string;

    /**
     * URL to navigate to when back button is clicked
     * @default "/surveys"
     */
    href?: string;

    /**
     * Custom click handler (overrides href)
     */
    onClick?: () => void;
  };

  /**
   * Action buttons to display on the right side of the header
   * (e.g., Save, Cancel, Edit, Delete)
   */
  actions: ReactNode;
}

/**
 * PageHeader - Reusable header component for pages
 *
 * Provides consistent layout for:
 * - Optional back button (hidden on mobile, visible on desktop)
 * - Action buttons (always visible)
 *
 * ## Responsive Behavior:
 * - **Desktop**: Back button on left, actions on right
 * - **Mobile**: Only actions on right (users use browser back)
 *
 * @example
 * ```tsx
 * <PageHeader
 *   backButton={{ label: "Back to Surveys", href: "/surveys" }}
 *   actions={
 *     <Stack direction="row" spacing={1}>
 *       <Button onClick={handleCancel}>Cancel</Button>
 *       <Button onClick={handleSave}>Save</Button>
 *     </Stack>
 *   }
 * />
 * ```
 */
export function PageHeader({ title, backButton, actions }: PageHeaderProps) {
  const { isMobile } = useResponsive();
  const navigate = useNavigate();

  const handleBackClick = () => {
    if (backButton?.onClick) {
      backButton.onClick();
    } else if (backButton?.href) {
      navigate(backButton.href);
    }
  };

  // On phones a display-size title and the action buttons can't share a row —
  // the title truncates to "Record s…" — so the header stacks: title first,
  // actions right-aligned beneath it.
  const stacked = isMobile && !!title;

  return (
    <Stack
      direction={stacked ? 'column' : 'row'}
      alignItems={stacked ? 'stretch' : 'center'}
      justifyContent={isMobile && !title ? 'flex-end' : 'space-between'}
      sx={{ mb: 3, gap: stacked ? 1 : 1.5 }}
    >
      <Box sx={{ minWidth: 0 }}>
        {!isMobile && backButton && (
          <Link
            component="button"
            onClick={handleBackClick}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              textDecoration: 'none',
              color: 'text.secondary',
              '&:hover': {
                color: 'primary.main',
              },
            }}
          >
            <ArrowBack sx={{ fontSize: 16 }} />
            {backButton.label || 'Back to Surveys'}
          </Link>
        )}
        {title && (
          <Typography
            component="h1"
            noWrap
            sx={{
              fontFamily: displayFontFamily,
              fontSize: 22,
              fontWeight: 600,
              lineHeight: 1.25,
              mt: !isMobile && backButton ? 0.5 : 0,
            }}
          >
            {title}
          </Typography>
        )}
      </Box>
      <Box sx={{ flexShrink: 0, alignSelf: stacked ? 'flex-end' : undefined }}>{actions}</Box>
    </Stack>
  );
}
