# Responsive Design System

This document explains how responsive design is managed in this application.

## Overview

Our application uses a **centralized configuration system** for all responsive design decisions. This makes it easy to understand and modify mobile vs desktop behavior in one place.

## Key Files

### 1. `src/config/responsive.ts`
**The single source of truth for all responsive settings.**

- **MOBILE_BREAKPOINT**: Defines where mobile ends and desktop begins (currently `'md'` = 900px)
- **FONT_SIZES**: Font size constants (16px minimum for mobile to prevent zoom)
- **SPACING**: Common spacing values
- **Z_INDEX**: Z-index layering constants

**To change the mobile/desktop breakpoint**, edit `MOBILE_BREAKPOINT` in this file.

### 2. `src/hooks/useResponsive.ts`
**Custom hook that wraps MUI's useMediaQuery with our configuration.**

Returns:
- `isMobile`: true when screen < 900px
- `isDesktop`: true when screen ≥ 900px
- `theme`: MUI theme object

Usage:
```tsx
import { useResponsive } from '../hooks/useResponsive';

function MyComponent() {
  const { isMobile, isDesktop } = useResponsive();

  return isMobile ? <MobileLayout /> : <DesktopLayout />;
}
```

### 3. `src/components/layout/PageHeader.tsx`
**Reusable header component for consistent page layouts.**

Features:
- Optional back button (hidden on mobile, visible on desktop)
- Action buttons (always visible)
- Handles responsive behavior automatically

Usage:
```tsx
<PageHeader
  backButton={{ href: '/surveys' }}
  actions={
    <Stack direction="row" spacing={1}>
      <Button>Cancel</Button>
      <Button>Save</Button>
    </Stack>
  }
/>
```

## Our Responsive Strategy

### Mobile (< 900px)
- **Full-screen modals** for forms and data entry
- **Card-based layouts** for better touch interaction
- **Hidden back buttons** (users use browser/swipe navigation)
- **16px minimum font size** on inputs to prevent mobile zoom
- **Vertical stacking** of form fields

### Desktop (≥ 900px)
- **Inline editing** with tables and autocompletes
- **Traditional layouts** with horizontal space utilization
- **Visible back buttons** for quick navigation
- **Standard font sizes** (0.875rem = 14px typically)
- **Horizontal layouts** where appropriate

## Making Changes

### Changing the Mobile/Desktop Breakpoint

Edit `MOBILE_BREAKPOINT` in `src/config/responsive.ts`:

```typescript
// Options: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
// Default MUI values: xs=0, sm=600, md=900, lg=1200, xl=1536
export const MOBILE_BREAKPOINT = 'md' as const; // Change this
```

All components using `useResponsive()` will automatically update.

### Adding Mobile-Only or Desktop-Only Features

```tsx
import { useResponsive } from '@/hooks/useResponsive';

function MyComponent() {
  const { isMobile, isDesktop } = useResponsive();

  return (
    <>
      {isMobile && <MobileOnlyFeature />}
      {isDesktop && <DesktopOnlyFeature />}

      {/* Or conditional rendering */}
      <Box sx={{ display: { xs: 'block', md: 'none' } }}>
        Mobile Only (CSS approach)
      </Box>
    </>
  );
}
```

### Adjusting Font Sizes

Edit `FONT_SIZES` in `src/config/responsive.ts`:

```typescript
export const FONT_SIZES = {
  MOBILE_INPUT_MIN: '16px', // Must be ≥16px to prevent zoom
  DESKTOP_INPUT: '0.875rem',
  BODY: '1rem',
} as const;
```

## Components Using Responsive Config

### Pages
- `NewSurveyPage` - Uses `PageHeader` for responsive back button
- `SurveyDetailPage` - Uses `PageHeader` for responsive back button

### Components
- `SightingsEditor` - Switches between card UI (mobile) and table (desktop)
- `AddSightingModal` - Full-screen on mobile, standard modal on desktop
- `PageHeader` - Hides back button on mobile, shows on desktop

## Best Practices

1. **Always use `useResponsive()` hook** instead of directly calling `useMediaQuery`
2. **Keep responsive logic DRY** - extract to shared components when possible
3. **Document responsive behavior** in component comments
4. **Test on actual mobile devices** - emulators don't always match reality
5. **Use semantic breakpoints** - think "mobile" vs "desktop", not pixel widths

## References

- [MUI Breakpoints Documentation](https://mui.com/material-ui/customization/breakpoints/)
- [MUI useMediaQuery Hook](https://mui.com/material-ui/react-use-media-query/)
- [Responsive Best Practices](https://muhimasri.com/blogs/mui-breakpoint/)

## Questions?

When Claude makes responsive changes:
- Check `src/config/responsive.ts` first
- Look at `useResponsive` hook usage
- Check if `PageHeader` or other shared components can be used
- Ensure changes are consistent with existing responsive strategy
