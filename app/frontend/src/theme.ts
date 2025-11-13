import { createTheme } from '@mui/material/styles';

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

// Simple, clean theme - professional and minimal
export const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2', // Clean blue
    },
    secondary: {
      main: '#dc004e', // Accent red
    },
    background: {
      default: '#fafafa',
      paper: '#ffffff',
    },
    text: {
      primary: '#1a1a1a',
      secondary: '#666666',
    },
  },
  typography: {
    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    fontSize: 14,
    h1: {
      fontSize: '2rem',
      fontWeight: 500,
    },
    h2: {
      fontSize: '1.5rem',
      fontWeight: 500,
    },
    h3: {
      fontSize: '1.25rem',
      fontWeight: 500,
    },
    body1: {
      fontSize: '0.875rem',
    },
  },
  shape: {
    borderRadius: 4,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          boxShadow: 'none',
          '&:hover': {
            boxShadow: 'none',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
        },
      },
    },
  },
});
