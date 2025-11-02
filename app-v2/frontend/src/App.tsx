import { ThemeProvider, CssBaseline, Box, Typography } from '@mui/material';
import { theme } from './theme';
import { SurveysPage } from './pages/SurveysPage';

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ height: '100vh', width: '100vw', bgcolor: 'background.default', overflow: 'auto' }}>
        {/* Simple header */}
        <Box sx={{ p: 3, bgcolor: 'background.paper', borderBottom: '1px solid #e0e0e0' }}>
          <Typography variant="h1">Wildlife Survey Management</Typography>
        </Box>

        {/* Main content - showing SurveysPage */}
        <SurveysPage />
      </Box>
    </ThemeProvider>
  );
}

export default App;
