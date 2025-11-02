import { Paper, Typography, Chip, Stack } from '@mui/material';
import { BugReport, Pets } from '@mui/icons-material';

// Define what data this component needs
interface SurveyCardProps {
  title: string;
  location: string;
  date: string;
  status: string;
  butterflies: number;
  birds: number;
}

// This is the EXTRACTED component - same code that was repeated 3 times!
export function SurveyCard({ title, location, date, status, butterflies, birds }: SurveyCardProps) {
  return (
    <Paper sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h3">
          {title}
        </Typography>
        <Chip
          label={status}
          color={status === 'Completed' ? 'success' : 'info'}
          size="small"
        />
      </Stack>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
        Location: {location}<br />
        Date: {date}
      </Typography>
      <Stack direction="row" spacing={1}>
        <Chip
          icon={<BugReport />}
          label={`Butterflies: ${butterflies}`}
          size="small"
          variant="outlined"
          color="secondary"
        />
        <Chip
          icon={<Pets />}
          label={`Birds: ${birds}`}
          size="small"
          variant="outlined"
          color="primary"
        />
      </Stack>
    </Paper>
  );
}
