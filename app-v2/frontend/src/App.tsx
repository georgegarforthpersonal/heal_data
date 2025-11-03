import { ThemeProvider, CssBaseline, Box, Typography } from '@mui/material';
import { theme } from './theme';
import { SurveysPage } from './pages/SurveysPage';

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ height: '100vh', width: '100vw', bgcolor: 'background.default', overflow: 'auto' }}>
        {/* Main content - showing SurveysPage */}
        <SurveysPage />
      </Box>
    </ThemeProvider>
  );
}

export default App;
