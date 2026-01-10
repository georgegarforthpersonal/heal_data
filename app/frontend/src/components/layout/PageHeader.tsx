import { type ReactNode } from 'react';
import { Stack, Link } from '@mui/material';
import { ArrowBack } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useResponsive } from '../../hooks/useResponsive';

interface PageHeaderProps {
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
export function PageHeader({ backButton, actions }: PageHeaderProps) {
  const { isMobile } = useResponsive();
  const navigate = useNavigate();

  const handleBackClick = () => {
    if (backButton?.onClick) {
      backButton.onClick();
    } else if (backButton?.href) {
      navigate(backButton.href);
    }
  };

  return (
    <Stack
      direction="row"
      alignItems="center"
      justifyContent={isMobile ? 'flex-end' : 'space-between'}
      sx={{ mb: 3 }}
    >
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
      {actions}
    </Stack>
  );
}
