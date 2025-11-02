import { Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip } from '@mui/material';

export function SurveysPage() {
  // Mock data - will come from API later
  const surveys = [
    {
      id: 1,
      title: 'Meadow Butterfly Survey',
      location: 'Heal Rewilding Site A',
      date: 'Oct 25, 2025',
      status: 'Completed',
      butterflies: 45,
      birds: 23,
    },
    {
      id: 2,
      title: 'Woodland Bird Count',
      location: 'Heal Rewilding Site B',
      date: 'Oct 28, 2025',
      status: 'In Progress',
      butterflies: 12,
      birds: 67,
    },
    {
      id: 3,
      title: 'Spring Migration Survey',
      location: 'Heal Rewilding Site C',
      date: 'Oct 30, 2025',
      status: 'Completed',
      butterflies: 89,
      birds: 156,
    },
  ];

  return (
    <Box sx={{ p: 3 }}>
      {/* Page header */}
      <Typography variant="h1" sx={{ mb: 1 }}>
        Surveys
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Wildlife survey records and data
      </Typography>

      {/* Table view */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Survey Title</TableCell>
              <TableCell>Location</TableCell>
              <TableCell>Date</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Butterflies</TableCell>
              <TableCell align="right">Birds</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {surveys.map((survey) => (
              <TableRow
                key={survey.id}
                sx={{ '&:hover': { bgcolor: 'action.hover' } }}
              >
                <TableCell>
                  <Typography variant="body1" sx={{ fontWeight: 500 }}>
                    {survey.title}
                  </Typography>
                </TableCell>
                <TableCell>{survey.location}</TableCell>
                <TableCell>{survey.date}</TableCell>
                <TableCell>
                  <Chip
                    label={survey.status}
                    color={survey.status === 'Completed' ? 'success' : 'info'}
                    size="small"
                  />
                </TableCell>
                <TableCell align="right">{survey.butterflies}</TableCell>
                <TableCell align="right">{survey.birds}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
