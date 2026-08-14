/**
 * Groups design tokens.
 *
 * The greens derive from the Canopy brand ramp (theme.ts) — Groups pioneered
 * the green-on-neutral look that is now the whole app's identity. The
 * neutrals and amber treatment stay scoped to Groups.
 */
import { brandColors } from '../../theme';

export const groupColors = {
  brand: brandColors.main,
  brandDark: brandColors.dark,
  brandHover: brandColors.hover,

  page: '#fafafa',
  paper: '#ffffff',

  textPrimary: '#1a1a1a',
  textSecondary: '#666666',
  // 4.95:1 on white — #888 (3.55:1) failed WCAG AA for the small text this
  // token is used on everywhere.
  textMuted: '#707070',

  divider: 'rgba(0,0,0,0.12)',
  dividerInner: 'rgba(0,0,0,0.06)',

  // "Needs a survey" amber treatment. Foregrounds are dark enough to pass
  // AA on their tinted chip/row backgrounds, not just on white.
  amberRowBg: '#FFFCF3',
  amberText: '#8A6D00',
  amberMonth: '#7A6000',
} as const;

// Card chrome shared by every Group panel.
export const groupCardSx = {
  bgcolor: groupColors.paper,
  border: `1px solid ${groupColors.divider}`,
  borderRadius: '10px',
  boxShadow: 'none',
} as const;

export const GROUP_MAX_WIDTH = 1120;

// The contained "Record survey" button, shared by the worklist row and the
// All surveys page. brandDark ground: white 13px text on brand main is 4.15:1
// (under AA); on dark it's 6.2:1. 44px minimum touch target on phones.
export const recordButtonSx = {
  flexShrink: 0,
  bgcolor: groupColors.brandDark,
  '&:hover': { bgcolor: groupColors.brand },
  borderRadius: '7px',
  textTransform: 'none',
  fontSize: 13,
  px: 1.5,
  py: 0.6,
  minHeight: { xs: 44, sm: 32 },
} as const;

// The neutral icon+count chip used for per-species-type breakdowns (survey
// rows, species-count summaries).
export const typeCountChipSx = {
  display: 'flex',
  alignItems: 'center',
  gap: 0.5,
  px: 1,
  py: 0.4,
  borderRadius: '6px',
  bgcolor: '#EBECED',
  color: '#454648',
  fontSize: 12.5,
  fontWeight: 600,
} as const;

// The small Map/List and Chart/List view toggle shared by the Locations and
// Species count panels. Text darkened for AA; phones get taller targets.
export const viewToggleSx = {
  bgcolor: '#f1f3f1',
  borderRadius: '7px',
  p: '3px',
  flexShrink: 0,
  '& .MuiToggleButton-root': {
    border: 'none',
    borderRadius: '5px !important',
    px: 1.25,
    py: 0.4,
    minHeight: { xs: 40, sm: 28 },
    color: groupColors.textSecondary,
    textTransform: 'none',
    fontSize: 12.5,
    gap: 0.5,
  },
  '& .Mui-selected': {
    bgcolor: '#fff !important',
    color: `${groupColors.textPrimary} !important`,
    boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
  },
} as const;

// Tertiary text-button treatment (Retry, Load more, inline expanders) — one
// token so the next contrast audit has a single place to look.
export const linkButtonSx = {
  textTransform: 'none',
  color: groupColors.brandDark,
  fontWeight: 600,
} as const;

// Shared header treatment for group panel titles. Rendered as a real <h2> so
// the page has a navigable heading outline (the hero carries the <h1>).
export const panelTitleSx = {
  fontSize: 15,
  fontWeight: 600,
  color: groupColors.textPrimary,
  m: 0,
} as const;

// Surveyor avatar palette (cycled). A freshly-assigned surveyor renders green.
const SURVEYOR_AVATAR_COLORS = ['#6b7280', '#7c6f64', '#5f6b7a', '#7a6678'] as const;

export function surveyorAvatarColor(seed: number): string {
  return SURVEYOR_AVATAR_COLORS[seed % SURVEYOR_AVATAR_COLORS.length];
}

/** Initials for a surveyor name, e.g. "Maya Patel" → "MP". */
export function surveyorInitials(firstName: string, lastName: string | null): string {
  const a = firstName?.trim()?.[0] ?? '';
  const b = lastName?.trim()?.[0] ?? '';
  return (a + b).toUpperCase() || a.toUpperCase() || '?';
}
