/**
 * Groups design tokens.
 *
 * The greens derive from the Canopy brand ramp (theme.ts) — Groups pioneered
 * the green-on-neutral look that is now the whole app's identity. The
 * neutrals and amber treatment stay scoped to Groups.
 */
import { brandColors, inkColors } from '../../theme';

export const groupColors = {
  brand: brandColors.main,
  brandDark: brandColors.dark,
  brandHover: brandColors.hover,

  page: inkColors.canvas,
  paper: inkColors.paper,

  textPrimary: inkColors.text,
  textSecondary: inkColors.textSecondary,
  textMuted: inkColors.textMuted,

  divider: inkColors.divider,
  dividerInner: inkColors.dividerInner,

  // "Needs a survey" amber treatment
  amberRowBg: '#FFFCF3',
  amberText: '#B0860A',
  amberMonth: '#C99A00',
} as const;

// Card chrome shared by every Group panel.
export const groupCardSx = {
  bgcolor: groupColors.paper,
  border: `1px solid ${groupColors.divider}`,
  borderRadius: '12px',
  boxShadow: 'none',
} as const;

export const GROUP_MAX_WIDTH = 1120;

// The contained "Record survey" button, shared by the worklist row and the
// All surveys page.
export const recordButtonSx = {
  flexShrink: 0,
  bgcolor: groupColors.brand,
  '&:hover': { bgcolor: groupColors.brandHover },
  borderRadius: '7px',
  textTransform: 'none',
  fontSize: 13,
  px: 1.5,
  py: 0.6,
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
