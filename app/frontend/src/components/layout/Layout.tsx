import { Box } from '@mui/material';
import { useEffect, useRef, type ReactNode } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';
import { TopNavBar } from './TopNavBar';

interface LayoutProps {
  children: ReactNode;
}

// Scroll positions per history entry (location.key), surviving remounts for
// the session. The app scrolls in Layout's inner container — not window —
// so the browser's native scroll restoration can't see it.
const scrollPositions = new Map<string, number>();

/**
 * Restore the inner scroller across navigation: browser Back/Forward (POP)
 * returns to where the user left that entry; a fresh navigation (PUSH —
 * e.g. "View all" tapped from the bottom of a long page) starts at the top
 * instead of inheriting the previous page's scroll offset.
 */
function useScrollRestoration(scroller: React.RefObject<HTMLDivElement | null>) {
  const location = useLocation();
  const navigationType = useNavigationType();

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    el.scrollTop = navigationType === 'POP' ? (scrollPositions.get(location.key) ?? 0) : 0;

    const save = () => scrollPositions.set(location.key, el.scrollTop);
    el.addEventListener('scroll', save, { passive: true });
    return () => el.removeEventListener('scroll', save);
  }, [location.key, navigationType, scroller]);
}

/**
 * Main Layout component with top navigation
 *
 * Features:
 * - Top navigation bar with logo and nav icons
 * - Responsive design (hamburger menu on mobile)
 * - Scrollable content area with per-history-entry scroll restoration
 * - Clean, modern design following 2025 UX best practices
 */
export function Layout({ children }: LayoutProps) {
  const scroller = useRef<HTMLDivElement | null>(null);
  useScrollRestoration(scroller);

  // 100dvh tracks the visible viewport as mobile browser toolbars expand/collapse;
  // the 100vh line is the fallback for browsers without dvh support
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        '@supports (height: 100dvh)': { height: '100dvh' },
        overflow: 'hidden',
      }}
    >
      {/* Top Navigation Bar */}
      <TopNavBar />

      {/* Main Content Area */}
      <Box
        ref={scroller}
        sx={{
          flexGrow: 1,
          overflow: 'auto',
          bgcolor: 'background.default',
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
