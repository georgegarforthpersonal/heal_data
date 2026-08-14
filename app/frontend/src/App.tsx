import { ThemeProvider, CssBaseline } from '@mui/material';
import { useEffect, useState } from 'react';
import {
  createBrowserRouter,
  RouterProvider,
  Navigate,
  Outlet,
  useLocation,
  useParams,
  useRouteError,
} from 'react-router-dom';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import 'dayjs/locale/en-gb';
import { theme } from './theme';
import { Layout } from './components/layout/Layout';
import { AuthProvider } from './context/AuthContext';
import { RequireAuth } from './components/auth/RequireAuth';
import { LoginPage } from './pages/auth/LoginPage';
import { AcceptInvitePage } from './pages/auth/AcceptInvitePage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage';
import { ToastProvider } from './context/ToastContext';
import { SurveysPage } from './pages/SurveysPage';
import { SurveyDetailPage } from './pages/SurveyDetailPage';
import { NewSurveyPage } from './pages/NewSurveyPage';
import { SpeciesPage } from './pages/SpeciesPage';
import { TrackingPage } from './pages/TrackingPage';
import { AdminPage } from './pages/AdminPage';
import { NewCameraTrapSurveyPage } from './pages/NewCameraTrapSurveyPage';
import { NewAudioSurveyPage } from './pages/NewAudioSurveyPage';
import GroupsPage from './pages/groups/GroupsPage';
import GroupDetailPage from './pages/groups/GroupDetailPage';
import AllSurveysPage from './pages/groups/AllSurveysPage';
import GroupMediaPage from './pages/groups/GroupMediaPage';
import { legacyGroupSlug, orgHasGroups } from './pages/groups/groupMeta';

// Set dayjs to use UK locale globally (dd/mm/yyyy format)
dayjs.locale('en-gb');

/**
 * Data routers catch render errors themselves by default. Rethrow so errors
 * keep bubbling up to the Sentry.ErrorBoundary in main.tsx, as they did with
 * the declarative <BrowserRouter>.
 */
function BubbleRouteError(): never {
  throw useRouteError();
}

/** "Teams" became "Groups" became "Surveys"; old bookmarks keep working. */
function LegacyTeamsRedirect() {
  const location = useLocation();
  return (
    <Navigate
      to={{ ...location, pathname: location.pathname.replace(/^\/teams/, '/groups') }}
      replace
    />
  );
}

/**
 * Legacy /groups/:typeId[/…] URLs redirect to their /surveys equivalents.
 * A slug param forwards verbatim; a pre-slug numeric group id resolves to
 * its slug first — /surveys/<number> means a recorded survey, not a group.
 */
function LegacyGroupsRedirect() {
  const location = useLocation();
  const { typeId } = useParams<{ typeId: string }>();
  const [resolved, setResolved] = useState<string | null | 'pending'>(
    typeId && /^\d+$/.test(typeId) ? 'pending' : (typeId?.toLowerCase() ?? null),
  );

  useEffect(() => {
    if (resolved !== 'pending' || !typeId) return;
    let active = true;
    legacyGroupSlug(typeId).then((slug) => active && setResolved(slug));
    return () => {
      active = false;
    };
  }, [typeId, resolved]);

  if (resolved === 'pending') return null; // resolving the numeric id
  if (resolved === null) return <Navigate to="/surveys" replace />;
  const rest = location.pathname.replace(/^\/groups\/[^/]+/, '');
  return <Navigate to={{ ...location, pathname: `/surveys/${resolved}${rest}` }} replace />;
}

/**
 * /surveys/:typeId serves two pages: a numeric param is a recorded survey's
 * detail page (the pre-existing URLs), anything else is a group's survey
 * page addressed by name slug (e.g. /surveys/butterfly).
 */
function SurveyOrGroupPage() {
  const { typeId } = useParams<{ typeId: string }>();
  return /^\d+$/.test(typeId ?? '') ? <SurveyDetailPage /> : <GroupDetailPage />;
}


// Data router (createBrowserRouter) rather than declarative <BrowserRouter>
// so that useBlocker can intercept in-app navigation (unsaved-changes guard).
const router = createBrowserRouter([
  {
    errorElement: <BubbleRouteError />,
    element: (
      <AuthProvider>
        <ToastProvider>
          <Outlet />
        </ToastProvider>
      </AuthProvider>
    ),
    children: [
      // Auth pages: reachable anonymously, rendered without the app chrome
      { path: '/login', element: <LoginPage /> },
      { path: '/accept-invite', element: <AcceptInvitePage /> },
      { path: '/forgot-password', element: <ForgotPasswordPage /> },
      { path: '/reset-password', element: <ResetPasswordPage /> },

      // Everything else requires a signed-in account
      {
        element: (
          <RequireAuth>
            <Layout>
              <Outlet />
            </Layout>
          </RequireAuth>
        ),
        children: [
          // Legacy /groups URLs — "Groups" is retired terminology; the pages
          // live under /surveys now. Old bookmarks and links keep working.
          { path: '/groups', element: <Navigate to="/surveys" replace /> },
          { path: '/groups/:typeId', element: <LegacyGroupsRedirect /> },
          { path: '/groups/:typeId/all', element: <LegacyGroupsRedirect /> },
          { path: '/groups/:typeId/media', element: <LegacyGroupsRedirect /> },
          { path: '/teams/*', element: <LegacyTeamsRedirect /> },

          // Dashboard page
          { path: '/species', element: <SpeciesPage /> },
          { path: '/tracking', element: <TrackingPage /> },
          // Old label, kept so existing links/bookmarks land correctly.
          { path: '/dashboards', element: <Navigate to="/species" replace /> },

          // Admin page
          { path: '/admin', element: <AdminPage /> },

          // Surveys home: the per-type survey grid where Groups covers the
          // org, the flat list for orgs without it.
          { path: '/surveys', element: orgHasGroups() ? <GroupsPage /> : <SurveysPage /> },

          // New survey page
          { path: '/surveys/new', element: <NewSurveyPage /> },

          // Camera trap survey wizard
          { path: '/surveys/new/camera-trap', element: <NewCameraTrapSurveyPage /> },

          // Audio survey wizard
          { path: '/surveys/new/audio', element: <NewAudioSurveyPage /> },

          // A numeric param is a recorded survey's detail page; a slug is a
          // group's survey page (/surveys/butterfly). Static /surveys/new
          // above always wins over this dynamic segment.
          { path: '/surveys/:typeId', element: <SurveyOrGroupPage /> },
          { path: '/surveys/:typeId/all', element: <AllSurveysPage /> },
          { path: '/surveys/:typeId/media', element: <GroupMediaPage /> },

          // Redirect root to the landing page
          { path: '/', element: <Navigate to="/surveys" replace /> },

          // Unmatched routes render an empty layout (as with <Routes> before)
          { path: '*', element: null },
        ],
      },
    ],
  },
]);

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="en-gb">
        <RouterProvider router={router} />
      </LocalizationProvider>
    </ThemeProvider>
  );
}

export default App;
