import { Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, Stack } from '@mui/material';

export function SurveysPage() {
  // Mock data - will come from API later
  const surveys = [
    {
      id: 1,
      date: 'Oct 25, 2025',
      surveyors: ['John Smith', 'Jane Doe'],
      location: 'Heal Rewilding Site A',
      sightings: [
        { type: 'butterflies', count: 45 },
        { type: 'birds', count: 23 },
      ],
    },
    {
      id: 2,
      date: 'Oct 28, 2025',
      surveyors: ['Mike Johnson'],
      location: 'Heal Rewilding Site B',
      sightings: [
        { type: 'butterflies', count: 12 },
      ],
    },
    {
      id: 3,
      date: 'Oct 30, 2025',
      surveyors: ['Sarah Williams', 'Tom Brown', 'Emily Davis'],
      location: 'Heal Rewilding Site C',
      sightings: [
        { type: 'birds', count: 156 },
      ],
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
              <TableCell>Date</TableCell>
              <TableCell>Surveyors</TableCell>
              <TableCell>Sightings</TableCell>
              <TableCell>Location</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {surveys.map((survey) => (
              <TableRow
                key={survey.id}
                sx={{ '&:hover': { bgcolor: 'action.hover' } }}
              >
                <TableCell>{survey.date}</TableCell>
                <TableCell>
                  {/* Show first surveyor, then "+N more" if there are more */}
                  {survey.surveyors.length === 1
                    ? survey.surveyors[0]
                    : `${survey.surveyors[0]} +${survey.surveyors.length - 1} more`
                  }
                </TableCell>
                <TableCell>
                  {/* Chips for each sighting type - only shows non-zero values */}
                  <Stack direction="row" spacing={1}>
                    {survey.sightings.map((sighting, idx) => (
                      <Chip
                        key={idx}
                        label={`${sighting.type === 'butterflies' ? '🦋' : '🐦'} ${sighting.count}`}
                        size="small"
                        variant="outlined"
                        color={sighting.type === 'butterflies' ? 'secondary' : 'primary'}
                      />
                    ))}
                  </Stack>
                </TableCell>
                <TableCell>{survey.location}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
