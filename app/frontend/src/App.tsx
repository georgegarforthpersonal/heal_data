import { ThemeProvider, CssBaseline, Box } from '@mui/material';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { theme } from './theme';
import { SurveysPage } from './pages/SurveysPage';
import { SurveyDetailPage } from './pages/SurveyDetailPage';
import { NewSurveyPage } from './pages/NewSurveyPage';

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <Box sx={{ height: '100vh', width: '100vw', bgcolor: 'background.default', overflow: 'auto' }}>
          <Routes>
            {/* Main surveys list page */}
            <Route path="/surveys" element={<SurveysPage />} />

            {/* New survey page */}
            <Route path="/surveys/new" element={<NewSurveyPage />} />

            {/* Survey detail page */}
            <Route path="/surveys/:id" element={<SurveyDetailPage />} />

            {/* Redirect root to surveys */}
            <Route path="/" element={<Navigate to="/surveys" replace />} />
          </Routes>
        </Box>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
