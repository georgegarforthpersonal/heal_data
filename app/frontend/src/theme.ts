import { createTheme } from '@mui/material/styles';
import type { Theme } from '@mui/material/styles';
import { FONT_SIZES, MOBILE_BREAKPOINT } from './config/responsive';

/**
 * Canopy brand palette — the green ramp sampled from the Canopy logo. The
 * product identity (logo, chrome, primary colour) is Canopy for every
 * organisation; tenant identity appears as content (org name on the login
 * card and in the tab title), never as a colour scheme. Note: white text on
 * `main` sits just under WCAG AA for small text — prefer `dark` for small
 * green-on-white text.
 */
export const brandColors = {
  main: '#51895A',   // Mid green (logo)
  light: '#6CA477',  // Light green (logo)
  dark: '#3E6A45',   // Dark green (logo)
  hover: '#5D9668',  // Button hover state, between main and light
  tint: '#ECF3EC',   // Badge/background tint (logo)
} as const;

/**
 * Ink — the neutral ramp, warmed a step toward green so greys sit naturally
 * beside the brand ramp instead of reading as clinical blue-greys. The page
 * canvas is warm paper; cards stay pure white so they lift off it without
 * needing drop shadows.
 */
export const inkColors = {
  canvas: '#F7F6F2',                    // page background — warm paper
  paper: '#FFFFFF',
  text: '#20241F',                      // near-black with a green undertone
  textSecondary: '#5C645C',
  textMuted: '#7E857E',
  divider: 'rgba(35, 42, 35, 0.12)',    // card borders, rules
  dividerInner: 'rgba(35, 42, 35, 0.06)', // row separators inside cards
  outline: 'rgba(35, 42, 35, 0.22)',    // form field borders
  outlineHover: 'rgba(35, 42, 35, 0.4)',
} as const;

/**
 * Fraunces is the display face — the "field guide" voice, used only for hero
 * moments: page titles, group names, the sign-in heading. Everything else is
 * Inter. Loaded in index.html beside Inter.
 */
export const displayFontFamily = '"Fraunces", Georgia, "Times New Roman", serif';

/**
 * Elevation, replacing MUI's grey defaults with a soft green-tinted ramp.
 * Cards don't float (they're bordered); shadows are reserved for things that
 * genuinely hover — menus, dialogs, drag states — so when one appears it
 * means something.
 */
const softShadow = (y: number, blur: number, alpha: number, y2: number, blur2: number, alpha2: number) =>
  `0 ${y}px ${blur}px rgba(26,32,27,${alpha}), 0 ${y2}px ${blur2}px rgba(26,32,27,${alpha2})`;

const softShadows: [
  'none', string, string, string, string, string, string, string, string, string, string, string,
  string, string, string, string, string, string, string, string, string, string, string, string, string,
] = [
  'none',
  softShadow(1, 2, 0.05, 1, 1, 0.03),
  softShadow(1, 3, 0.06, 1, 2, 0.04),
  softShadow(2, 6, 0.07, 1, 2, 0.04),
  softShadow(3, 8, 0.08, 1, 3, 0.04),
  softShadow(4, 10, 0.08, 1, 3, 0.05),
  softShadow(5, 12, 0.09, 2, 4, 0.05),
  softShadow(6, 14, 0.09, 2, 4, 0.05),
  softShadow(8, 22, 0.12, 2, 6, 0.05),   // menus / popovers
  softShadow(9, 24, 0.12, 2, 6, 0.05),
  softShadow(10, 26, 0.13, 3, 7, 0.05),
  softShadow(11, 28, 0.13, 3, 7, 0.06),
  softShadow(12, 30, 0.14, 3, 8, 0.06),
  softShadow(13, 32, 0.14, 3, 8, 0.06),
  softShadow(14, 34, 0.15, 4, 9, 0.06),
  softShadow(15, 36, 0.15, 4, 9, 0.06),
  softShadow(16, 38, 0.16, 4, 10, 0.07),
  softShadow(17, 40, 0.16, 4, 10, 0.07),
  softShadow(18, 42, 0.17, 5, 11, 0.07),
  softShadow(19, 44, 0.17, 5, 11, 0.07),
  softShadow(20, 46, 0.18, 5, 12, 0.07),
  softShadow(21, 48, 0.18, 5, 12, 0.08),
  softShadow(22, 52, 0.19, 6, 13, 0.08),
  softShadow(23, 56, 0.2, 6, 14, 0.08),
  softShadow(24, 60, 0.22, 6, 16, 0.08),  // dialogs
];

// Notion-style color palette for tags/chips
// Each color has a background (light) and foreground (dark) shade
export const notionColors = {
  default: {
    background: '#E3E2E0',
    text: '#37352F',
  },
  gray: {
    background: '#EBECED',
    text: '#454648',
  },
  brown: {
    background: '#E9E5E3',
    text: '#64473A',
  },
  orange: {
    background: '#FADEC9',
    text: '#D9730D',
  },
  yellow: {
    background: '#FBF3DB',
    text: '#DFAB01',
  },
  green: {
    background: '#DBEDDB',
    text: '#4D6461',
  },
  blue: {
    background: '#D3E5EF',
    text: '#2B5F86',
  },
  purple: {
    background: '#E8DEEE',
    text: '#6940A5',
  },
  pink: {
    background: '#F5E0E9',
    text: '#AD5E99',
  },
  red: {
    background: '#FFE2DD',
    text: '#E03E3E',
  },
} as const;

// Table sizing constants for consistent spacing across pages
export const tableSizing = {
  header: {
    fontSize: '0.75rem',
    iconSize: 14,
    py: 1,
    px: 2,
  },
  row: {
    fontSize: '0.875rem',
    py: 1,
    px: 2,
  },
  avatar: {
    size: 28,
    fontSize: '0.7rem',
  },
  chip: {
    fontSize: '0.8125rem',
    height: 24,
    iconSize: '1rem',
  },
  actionIcon: {
    size: 18,
    padding: '6px',
  },
} as const;

// Brand theme — the one Canopy palette, for every organisation
export const theme: Theme = createTheme({
  palette: {
    primary: {
      main: brandColors.main,
      light: brandColors.light,
      dark: brandColors.dark,
      contrastText: '#fff',
    },
    secondary: {
      main: '#dc004e', // Keep red for accents/warnings
    },
    background: {
      default: inkColors.canvas,
      paper: inkColors.paper,
    },
    text: {
      primary: inkColors.text,
      secondary: inkColors.textSecondary,
    },
    divider: inkColors.divider,
  },
  typography: {
    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    fontSize: 14,
    // Tightened negative tracking on the larger sizes — Inter is loose at
    // display scale — and 600 for headings (hierarchy from weight, not caps).
    h1: { fontSize: '2rem', fontWeight: 600, letterSpacing: '-0.02em' },
    h2: { fontSize: '1.5rem', fontWeight: 600, letterSpacing: '-0.015em' },
    h3: { fontSize: '1.25rem', fontWeight: 600, letterSpacing: '-0.01em' },
    h4: { fontSize: '1.5rem', fontWeight: 600, letterSpacing: '-0.01em' },
    h5: { fontSize: '1.25rem', fontWeight: 600, letterSpacing: '-0.01em' },
    // The workhorse card/section title.
    h6: { fontSize: '1.05rem', fontWeight: 600, letterSpacing: '-0.005em' },
    subtitle2: { fontWeight: 600 },
    body1: { fontSize: '0.875rem' },
    button: { fontWeight: 600 },
  },
  shape: {
    // Unchanged: numeric `sx` borderRadius values multiply this, so raising it
    // would silently inflate every borderRadius: 1/1.5/2 in the codebase.
    // Component-level radii below carry the rounded look instead.
    borderRadius: 4,
  },
  shadows: softShadows,
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: 8,
          fontWeight: 600,
          boxShadow: 'none',
          '&:hover': {
            boxShadow: 'none',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        // Cards share one language: generous corners, borders over shadows.
        // (No blanket boxShadow here — menus and dialogs keep their soft
        // elevation from the ramp above.)
        rounded: {
          borderRadius: 12,
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: inkColors.outline,
          },
          '&:hover:not(.Mui-focused):not(.Mui-disabled) .MuiOutlinedInput-notchedOutline': {
            borderColor: inkColors.outlineHover,
          },
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 16,
        },
        paperFullScreen: {
          borderRadius: 0,
        },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          borderRadius: 10,
          border: `1px solid ${inkColors.dividerInner}`,
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 10,
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: '#252B26',
          borderRadius: 6,
          fontSize: '0.75rem',
        },
        arrow: {
          color: '#252B26',
        },
      },
    },
    MuiInputBase: {
      styleOverrides: {
        input: ({ theme }) => ({
          // iOS/Android auto-zoom on focus when the input font is below 16px
          [theme.breakpoints.down(MOBILE_BREAKPOINT)]: {
            fontSize: FONT_SIZES.MOBILE_INPUT_MIN,
          },
        }),
      },
    },
  },
});
