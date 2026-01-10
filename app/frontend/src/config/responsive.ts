/**
 * Responsive Configuration
 *
 * This file centralizes all responsive design decisions for the application.
 *
 * ## Our Responsive Strategy:
 *
 * - **Mobile**: Screens < 900px (MUI's 'md' breakpoint)
 *   - Full-screen modals for forms
 *   - Card-based layouts
 *   - Hidden back buttons (use browser navigation)
 *   - 16px minimum font size to prevent mobile zoom
 *
 * - **Desktop**: Screens ≥ 900px
 *   - Inline editing with tables/autocompletes
 *   - Traditional layouts with more horizontal space
 *   - Visible back buttons for navigation
 *   - Standard font sizes
 *
 * ## Making Changes:
 *
 * - To change the mobile/desktop breakpoint: Update MOBILE_BREAKPOINT below
 * - To adjust font sizes: Update FONT_SIZES below
 * - All components use the useResponsive hook which reads from this config
 *
 * ## References:
 * - MUI Breakpoints: https://mui.com/material-ui/customization/breakpoints/
 * - useMediaQuery: https://mui.com/material-ui/react-use-media-query/
 */

/**
 * The breakpoint that determines mobile vs desktop layouts
 * 'md' = 900px (MUI default)
 *
 * Options: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
 * Default values: xs=0, sm=600, md=900, lg=1200, xl=1536
 */
export const MOBILE_BREAKPOINT = 'md' as const;

/**
 * Font sizes optimized for mobile devices
 * 16px minimum prevents iOS/Android from auto-zooming on input focus
 */
export const FONT_SIZES = {
  /**
   * Minimum font size for input fields on mobile to prevent zoom
   */
  MOBILE_INPUT_MIN: '16px',

  /**
   * Standard input font size for desktop
   */
  DESKTOP_INPUT: '0.875rem', // 14px by default in MUI

  /**
   * Body text font size
   */
  BODY: '1rem', // 16px
} as const;

/**
 * Common spacing values for responsive layouts
 */
export const SPACING = {
  /**
   * Page padding that adjusts by screen size
   */
  PAGE_PADDING: { xs: 2, sm: 3, md: 4 },

  /**
   * Modal content padding
   */
  MODAL_PADDING: { xs: 2, sm: 3 },
} as const;

/**
 * Z-index values to ensure consistent layering
 */
export const Z_INDEX = {
  MODAL: 1300, // MUI Dialog default
  DRAWER: 1200, // MUI Drawer default
  APP_BAR: 1100, // MUI AppBar default
} as const;
