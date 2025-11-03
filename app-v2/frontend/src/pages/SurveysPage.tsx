import { Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, Stack, IconButton, Button } from '@mui/material';
import { Edit, Delete, CalendarToday, Person, Visibility, LocationOn, MoreHoriz, Assessment } from '@mui/icons-material';

export function SurveysPage() {
  // Handler functions - will connect to API later
  const handleEdit = (surveyId: number) => {
    console.log('Edit survey:', surveyId);
    // TODO: Open edit dialog or navigate to edit page
  };

  const handleDelete = (surveyId: number) => {
    console.log('Delete survey:', surveyId);
    // TODO: Show confirmation dialog, then delete
  };

  // Helper function to get colors for each sighting type
  const getSightingColors = (type: string) => {
    switch (type) {
      case 'butterflies':
        return { bgcolor: '#E8D5F2', color: '#7B2CBF' };
      case 'birds':
        return { bgcolor: '#D5E8F7', color: '#1976D2' };
      case 'fungi':
        return { bgcolor: '#FFE8D5', color: '#D97706' };
      default:
        return { bgcolor: '#E8D5F2', color: '#7B2CBF' };
    }
  };

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
    {
      id: 4,
      date: 'Nov 1, 2025',
      surveyors: ['Alice Cooper'],
      location: 'Heal Rewilding Site A',
      sightings: [
        { type: 'butterflies', count: 28 },
        { type: 'birds', count: 67 },
      ],
    },
    {
      id: 5,
      date: 'Nov 2, 2025',
      surveyors: ['Bob Wilson', 'Carol Davis'],
      location: 'Heal Rewilding Site D',
      sightings: [
        { type: 'butterflies', count: 89 },
      ],
    },
    {
      id: 6,
      date: 'Nov 3, 2025',
      surveyors: ['David Lee'],
      location: 'Heal Rewilding Site B',
      sightings: [
        { type: 'birds', count: 34 },
      ],
    },
    {
      id: 7,
      date: 'Nov 5, 2025',
      surveyors: ['Emma Thomas', 'Frank Harris'],
      location: 'Heal Rewilding Site C',
      sightings: [
        { type: 'butterflies', count: 51 },
        { type: 'birds', count: 92 },
      ],
    },
    {
      id: 8,
      date: 'Nov 7, 2025',
      surveyors: ['Grace Martin'],
      location: 'Heal Rewilding Site A',
      sightings: [
        { type: 'butterflies', count: 76 },
      ],
    },
    {
      id: 9,
      date: 'Nov 8, 2025',
      surveyors: ['Henry Clark', 'Iris Walker', 'Jack Robinson'],
      location: 'Heal Rewilding Site E',
      sightings: [
        { type: 'birds', count: 143 },
      ],
    },
    {
      id: 10,
      date: 'Nov 10, 2025',
      surveyors: ['Karen White'],
      location: 'Heal Rewilding Site B',
      sightings: [
        { type: 'butterflies', count: 33 },
        { type: 'birds', count: 58 },
      ],
    },
    {
      id: 11,
      date: 'Nov 12, 2025',
      surveyors: ['Liam Brown', 'Maya Singh'],
      location: 'Heal Rewilding Site D',
      sightings: [
        { type: 'butterflies', count: 104 },
      ],
    },
    {
      id: 12,
      date: 'Nov 14, 2025',
      surveyors: ['Nathan Green'],
      location: 'Heal Rewilding Site A',
      sightings: [
        { type: 'birds', count: 71 },
      ],
    },
    {
      id: 13,
      date: 'Nov 15, 2025',
      surveyors: ['Olivia Turner', 'Paul Adams'],
      location: 'Heal Rewilding Site C',
      sightings: [
        { type: 'butterflies', count: 62 },
        { type: 'birds', count: 119 },
      ],
    },
    {
      id: 14,
      date: 'Nov 17, 2025',
      surveyors: ['Quinn Foster'],
      location: 'Heal Rewilding Site E',
      sightings: [
        { type: 'butterflies', count: 47 },
      ],
    },
    {
      id: 15,
      date: 'Nov 19, 2025',
      surveyors: ['Rachel Murphy', 'Sam Collins', 'Tina Brooks', 'Uma Patel'],
      location: 'Heal Rewilding Site B',
      sightings: [
        { type: 'birds', count: 87 },
      ],
    },
    {
      id: 16,
      date: 'Nov 20, 2025',
      surveyors: ['Victor Chen'],
      location: 'Heal Rewilding Site A',
      sightings: [
        { type: 'butterflies', count: 93 },
        { type: 'birds', count: 41 },
      ],
    },
    {
      id: 17,
      date: 'Nov 22, 2025',
      surveyors: ['Wendy Gray', 'Xavier Bell'],
      location: 'Heal Rewilding Site D',
      sightings: [
        { type: 'butterflies', count: 38 },
      ],
    },
    {
      id: 18,
      date: 'Nov 24, 2025',
      surveyors: ['Yara Mitchell'],
      location: 'Heal Rewilding Site C',
      sightings: [
        { type: 'birds', count: 205 },
      ],
    },
    {
      id: 19,
      date: 'Nov 26, 2025',
      surveyors: ['Zoe Parker', 'Aaron Scott'],
      location: 'Heal Rewilding Site E',
      sightings: [
        { type: 'butterflies', count: 81 },
        { type: 'birds', count: 134 },
      ],
    },
    {
      id: 20,
      date: 'Nov 28, 2025',
      surveyors: ['Blake Reed'],
      location: 'Heal Rewilding Site B',
      sightings: [
        { type: 'butterflies', count: 55 },
      ],
    },
  ];

  return (
    <Box sx={{ p: 3 }}>
      {/* Notion-style header */}
      <Box sx={{ mb: 2 }}>
        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
          <Assessment sx={{ fontSize: 32, color: 'text.secondary' }} />
          <Typography
            variant="h1"
            sx={{
              fontSize: '2rem',
              fontWeight: 700,
              color: 'text.primary'
            }}
          >
            Surveys
          </Typography>
        </Stack>

        {/* Actions */}
        <Stack direction="row" justifyContent="flex-end" alignItems="center">
          <Button
            variant="contained"
            size="small"
            sx={{
              textTransform: 'none',
              fontWeight: 600,
              boxShadow: 'none',
              '&:hover': { boxShadow: 'none' }
            }}
          >
            New
          </Button>
        </Stack>
      </Box>

      {/* Table view */}
      <TableContainer
        component={Paper}
        sx={{
          boxShadow: 'none',
          border: '1px solid',
          borderColor: 'divider'
        }}
      >
        <Table sx={{ minWidth: 650 }}>
          <TableHead>
            <TableRow sx={{ bgcolor: 'grey.50' }}>
              <TableCell
                sx={{
                  fontWeight: 500,
                  fontSize: '0.6875rem',
                  color: 'text.secondary',
                  textTransform: 'uppercase',
                  letterSpacing: '0.3px',
                  py: 0.75,
                  px: 1.5
                }}
              >
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  <CalendarToday sx={{ fontSize: 12 }} />
                  <span>Date</span>
                </Stack>
              </TableCell>
              <TableCell
                sx={{
                  fontWeight: 500,
                  fontSize: '0.6875rem',
                  color: 'text.secondary',
                  textTransform: 'uppercase',
                  letterSpacing: '0.3px',
                  py: 0.75,
                  px: 1.5
                }}
              >
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  <Person sx={{ fontSize: 12 }} />
                  <span>Surveyors</span>
                </Stack>
              </TableCell>
              <TableCell
                sx={{
                  fontWeight: 500,
                  fontSize: '0.6875rem',
                  color: 'text.secondary',
                  textTransform: 'uppercase',
                  letterSpacing: '0.3px',
                  py: 0.75,
                  px: 1.5
                }}
              >
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  <Visibility sx={{ fontSize: 12 }} />
                  <span>Sightings</span>
                </Stack>
              </TableCell>
              <TableCell
                sx={{
                  fontWeight: 500,
                  fontSize: '0.6875rem',
                  color: 'text.secondary',
                  textTransform: 'uppercase',
                  letterSpacing: '0.3px',
                  py: 0.75,
                  px: 1.5
                }}
              >
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  <LocationOn sx={{ fontSize: 12 }} />
                  <span>Location</span>
                </Stack>
              </TableCell>
              <TableCell
                align="right"
                sx={{
                  fontWeight: 500,
                  fontSize: '0.6875rem',
                  color: 'text.secondary',
                  textTransform: 'uppercase',
                  letterSpacing: '0.3px',
                  py: 0.75,
                  px: 1.5
                }}
              >
                <Stack direction="row" alignItems="center" spacing={0.5} justifyContent="flex-end">
                  <MoreHoriz sx={{ fontSize: 12 }} />
                  <span>Actions</span>
                </Stack>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {surveys.map((survey) => (
              <TableRow
                key={survey.id}
                sx={{
                  '&:hover': { bgcolor: 'grey.50' },
                  cursor: 'pointer',
                  borderBottom: '1px solid',
                  borderColor: 'divider'
                }}
              >
                <TableCell sx={{ py: 0.5, px: 1.5, fontSize: '0.8125rem' }}>
                  {survey.date}
                </TableCell>
                <TableCell sx={{ py: 0.5, px: 1.5, fontSize: '0.8125rem', color: 'text.secondary' }}>
                  {/* Show first surveyor, then "+N more" if there are more */}
                  {survey.surveyors.length === 1
                    ? survey.surveyors[0]
                    : `${survey.surveyors[0]} +${survey.surveyors.length - 1} more`
                  }
                </TableCell>
                <TableCell sx={{ py: 0.5, px: 1.5 }}>
                  {/* Chips for each sighting type - only shows non-zero values */}
                  <Stack direction="row" spacing={0.75}>
                    {survey.sightings.map((sighting, idx) => {
                      const colors = getSightingColors(sighting.type);
                      const emoji = sighting.type === 'butterflies' ? '🦋' : sighting.type === 'birds' ? '🐦' : '🍄';

                      return (
                        <Chip
                          key={idx}
                          label={`${emoji} ${sighting.count}`}
                          size="small"
                          sx={{
                            bgcolor: colors.bgcolor,
                            color: colors.color,
                            fontWeight: 500,
                            fontSize: '0.75rem',
                            height: '20px',
                            borderRadius: '3px',
                            '& .MuiChip-label': {
                              px: 0.75,
                              py: 0
                            }
                          }}
                        />
                      );
                    })}
                  </Stack>
                </TableCell>
                <TableCell sx={{ py: 0.5, px: 1.5, fontSize: '0.8125rem', color: 'text.secondary' }}>
                  {survey.location}
                </TableCell>
                <TableCell align="right" sx={{ py: 0.5, px: 1.5 }}>
                  {/* Action buttons - inline for now. Extract to SurveyActions component if used elsewhere */}
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEdit(survey.id);
                    }}
                    aria-label="edit survey"
                    sx={{
                      color: 'text.secondary',
                      padding: '4px',
                      '&:hover': { bgcolor: 'action.hover' }
                    }}
                  >
                    <Edit sx={{ fontSize: 16 }} />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(survey.id);
                    }}
                    aria-label="delete survey"
                    sx={{
                      color: 'text.secondary',
                      padding: '4px',
                      '&:hover': { bgcolor: 'error.lighter', color: 'error.main' }
                    }}
                  >
                    <Delete sx={{ fontSize: 16 }} />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
