import { useTheme, useMediaQuery } from '@mui/material';
import { MOBILE_BREAKPOINT } from '../config/responsive';

/**
 * Custom hook for responsive layout detection
 *
 * This hook provides a simple, consistent way to detect mobile vs desktop layouts
 * across the application. It uses the centralized MOBILE_BREAKPOINT configuration.
 *
 * @returns Object with responsive state flags
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { isMobile, isDesktop } = useResponsive();
 *
 *   return isMobile ? (
 *     <MobileLayout />
 *   ) : (
 *     <DesktopLayout />
 *   );
 * }
 * ```
 */
export function useResponsive() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down(MOBILE_BREAKPOINT));

  return {
    /**
     * True when screen is below the mobile breakpoint (< 900px)
     */
    isMobile,

    /**
     * True when screen is at or above the mobile breakpoint (≥ 900px)
     */
    isDesktop: !isMobile,

    /**
     * The theme object for accessing other breakpoints if needed
     */
    theme,
  };
}
