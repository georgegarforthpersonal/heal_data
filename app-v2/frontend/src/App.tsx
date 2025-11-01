import { ThemeProvider, CssBaseline, Box, Typography, Button, Paper } from '@mui/material';
import { theme } from './theme';

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ height: '100vh', width: '100vw', bgcolor: 'background.default', overflow: 'auto' }}>
        {/* Simple header */}
        <Box sx={{ p: 3, bgcolor: 'background.paper', borderBottom: '1px solid #e0e0e0' }}>
          <Typography variant="h1">Wildlife Survey Management</Typography>
        </Box>

        {/* Main content */}
        <Box sx={{ p: 3 }}>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            A simple, clean starting point for building your application
          </Typography>

          {/* Button examples */}
          <Box sx={{ mb: 4, display: 'flex', gap: 2 }}>
            <Button variant="contained">Primary Button</Button>
            <Button variant="outlined">Outlined Button</Button>
            <Button variant="text">Text Button</Button>
          </Box>

          {/* Simple card/paper example */}
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h3" sx={{ mb: 2 }}>
              Example Section
            </Typography>
            <Typography variant="body1" color="text.secondary">
              This is a simple card component. Build your UI from small, simple pieces like this.
            </Typography>
          </Paper>

          {/* Another card */}
          <Paper sx={{ p: 3 }}>
            <Typography variant="h3" sx={{ mb: 2 }}>
              Next Steps
            </Typography>
            <Typography variant="body1" color="text.secondary" component="div">
              <ul style={{ margin: 0, paddingLeft: '1.5rem' }}>
                <li>Adjust theme colors in src/theme.ts</li>
                <li>Create small, reusable components</li>
                <li>Build up your pages incrementally</li>
                <li>Keep it simple and clean</li>
              </ul>
            </Typography>
          </Paper>
        </Box>
      </Box>
    </ThemeProvider>
  );
}

export default App;
