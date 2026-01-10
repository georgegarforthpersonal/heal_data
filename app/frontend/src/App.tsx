import { ThemeProvider, CssBaseline } from '@mui/material';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import 'dayjs/locale/en-gb';
import { theme } from './theme';
import { Layout } from './components/layout/Layout';
import { SurveysPage } from './pages/SurveysPage';
import { SurveyDetailPage } from './pages/SurveyDetailPage';
import { NewSurveyPage } from './pages/NewSurveyPage';
import { DashboardsPage } from './pages/DashboardsPage';
import { AdminPage } from './pages/AdminPage';

// Set dayjs to use UK locale globally (dd/mm/yyyy format)
dayjs.locale('en-gb');

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="en-gb">
        <BrowserRouter>
          <Layout>
            <Routes>
              {/* Dashboard page */}
              <Route path="/dashboards" element={<DashboardsPage />} />

              {/* Admin page */}
              <Route path="/admin" element={<AdminPage />} />

              {/* Main surveys list page */}
              <Route path="/surveys" element={<SurveysPage />} />

              {/* New survey page */}
              <Route path="/surveys/new" element={<NewSurveyPage />} />

              {/* Survey detail page */}
              <Route path="/surveys/:id" element={<SurveyDetailPage />} />

              {/* Redirect root to surveys */}
              <Route path="/" element={<Navigate to="/surveys" replace />} />
            </Routes>
          </Layout>
        </BrowserRouter>
      </LocalizationProvider>
    </ThemeProvider>
  );
}

export default App;
