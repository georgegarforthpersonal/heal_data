import { Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, Stack, Button, Avatar, AvatarGroup, Tooltip } from '@mui/material';
import { CalendarToday, Person, Visibility, LocationOn, Assignment } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { ButterflyIcon, BirdIcon, MushroomIcon } from '../components/icons/WildlifeIcons';
import { notionColors, tableSizing } from '../theme';

/**
 * SurveysPage displays a table of wildlife surveys with:
 * - Date, surveyors (avatar stack), sightings (chips with icons), and location
 * - Edit and delete actions per row
 * - Notion-style design with clean, minimal aesthetics
 * - Clickable rows that navigate to survey detail pages
 *
 * Following DEVELOPMENT.md conventions:
 * - Built inline first (no premature component extraction)
 * - Uses MUI components with theme integration
 * - Mock data ready to be replaced with API calls
 */
export function SurveysPage() {
  const navigate = useNavigate();

  // ============================================================================
  // Event Handlers - Will connect to API later
  // ============================================================================

  const handleRowClick = (surveyId: number) => {
    navigate(`/surveys/${surveyId}`);
  };

  // ============================================================================
  // Helper Functions
  // ============================================================================

  /**
   * Extracts initials from a full name (e.g., "John Smith" → "JS")
   */
  const getInitials = (name: string): string => {
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return parts[0][0].toUpperCase();
  };

  /**
   * Returns Notion-style gray colors for all sighting chips
   * Keeps visual focus on icons rather than colors
   */
  const getSightingColors = () => {
    return { bgcolor: notionColors.gray.background, color: notionColors.gray.text };
  };

  /**
   * Capitalizes first letter of a string (e.g., "butterflies" → "Butterflies")
   */
  const capitalize = (str: string): string => {
    return str.charAt(0).toUpperCase() + str.slice(1);
  };

  // ============================================================================
  // Mock Data - Will come from API later
  // TODO: Replace with API call: const { data: surveys } = useSurveys();
  // ============================================================================

  const surveys = [
    {
      id: 1,
      date: 'Oct 25, 2025',
      surveyors: ['John Smith', 'Jane Doe'],
      location: 'Northern',
      sightings: [
        { type: 'butterflies', count: 45 },
        { type: 'birds', count: 23 },
        { type: 'fungi', count: 18 },
      ],
    },
    {
      id: 2,
      date: 'Oct 28, 2025',
      surveyors: ['Mike Johnson'],
      location: 'Eastern',
      sightings: [
        { type: 'butterflies', count: 12 },
      ],
    },
    {
      id: 3,
      date: 'Oct 30, 2025',
      surveyors: ['Sarah Williams', 'Tom Brown', 'Emily Davis', 'Michael Johnson', 'Jessica Lee', 'David Martinez', 'Lisa Anderson'],
      location: 'Southern',
      sightings: [
        { type: 'birds', count: 156 },
        { type: 'fungi', count: 42 },
      ],
    },
    {
      id: 4,
      date: 'Nov 1, 2025',
      surveyors: ['Alice Cooper'],
      location: 'Northern',
      sightings: [
        { type: 'butterflies', count: 28 },
        { type: 'birds', count: 67 },
      ],
    },
    {
      id: 5,
      date: 'Nov 2, 2025',
      surveyors: ['Bob Wilson', 'Carol Davis'],
      location: 'Eastern',
      sightings: [
        { type: 'butterflies', count: 89 },
      ],
    },
    {
      id: 6,
      date: 'Nov 3, 2025',
      surveyors: ['David Lee'],
      location: 'Eastern',
      sightings: [
        { type: 'birds', count: 34 },
      ],
    },
    {
      id: 7,
      date: 'Nov 5, 2025',
      surveyors: ['Emma Thomas', 'Frank Harris'],
      location: 'Southern',
      sightings: [
        { type: 'butterflies', count: 51 },
        { type: 'birds', count: 92 },
        { type: 'fungi', count: 27 },
      ],
    },
    {
      id: 8,
      date: 'Nov 7, 2025',
      surveyors: ['Grace Martin'],
      location: 'Northern',
      sightings: [
        { type: 'butterflies', count: 76 },
      ],
    },
    {
      id: 9,
      date: 'Nov 8, 2025',
      surveyors: ['Henry Clark', 'Iris Walker', 'Jack Robinson'],
      location: 'Southern',
      sightings: [
        { type: 'birds', count: 143 },
      ],
    },
    {
      id: 10,
      date: 'Nov 10, 2025',
      surveyors: ['Karen White'],
      location: 'Eastern',
      sightings: [
        { type: 'butterflies', count: 33 },
        { type: 'birds', count: 58 },
      ],
    },
    {
      id: 11,
      date: 'Nov 12, 2025',
      surveyors: ['Liam Brown', 'Maya Singh'],
      location: 'Eastern',
      sightings: [
        { type: 'butterflies', count: 104 },
      ],
    },
    {
      id: 12,
      date: 'Nov 14, 2025',
      surveyors: ['Nathan Green'],
      location: 'Northern',
      sightings: [
        { type: 'birds', count: 71 },
        { type: 'fungi', count: 35 },
      ],
    },
    {
      id: 13,
      date: 'Nov 15, 2025',
      surveyors: ['Olivia Turner', 'Paul Adams'],
      location: 'Southern',
      sightings: [
        { type: 'butterflies', count: 62 },
        { type: 'birds', count: 119 },
      ],
    },
    {
      id: 14,
      date: 'Nov 17, 2025',
      surveyors: ['Quinn Foster'],
      location: 'Southern',
      sightings: [
        { type: 'butterflies', count: 47 },
      ],
    },
    {
      id: 15,
      date: 'Nov 19, 2025',
      surveyors: ['Rachel Murphy', 'Sam Collins', 'Tina Brooks', 'Uma Patel', 'Vincent Wong', 'Sophie Chen'],
      location: 'Eastern',
      sightings: [
        { type: 'birds', count: 87 },
      ],
    },
    {
      id: 16,
      date: 'Nov 20, 2025',
      surveyors: ['Victor Chen'],
      location: 'Northern',
      sightings: [
        { type: 'fungi', count: 56 },
      ],
    },
    {
      id: 17,
      date: 'Nov 22, 2025',
      surveyors: ['Wendy Gray', 'Xavier Bell'],
      location: 'Eastern',
      sightings: [
        { type: 'butterflies', count: 38 },
      ],
    },
    {
      id: 18,
      date: 'Nov 24, 2025',
      surveyors: ['Yara Mitchell'],
      location: 'Southern',
      sightings: [
        { type: 'birds', count: 205 },
      ],
    },
    {
      id: 19,
      date: 'Nov 26, 2025',
      surveyors: ['Zoe Parker', 'Aaron Scott'],
      location: 'Southern',
      sightings: [
        { type: 'butterflies', count: 81 },
        { type: 'fungi', count: 29 },
      ],
    },
    {
      id: 20,
      date: 'Nov 28, 2025',
      surveyors: ['Blake Reed'],
      location: 'Eastern',
      sightings: [
        { type: 'butterflies', count: 55 },
      ],
    },
  ];

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <Box sx={{ p: 4 }}>
      {/* Page Header - Notion-style with icon and title */}
      <Box sx={{ mb: 3 }}>
        <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
          <Assignment sx={{ fontSize: 40, color: 'text.secondary' }} />
          <Typography
            variant="h1"
            sx={{
              fontSize: '2.5rem',
              fontWeight: 700,
              color: 'text.primary'
            }}
          >
            Surveys
          </Typography>
        </Stack>

        {/* Actions - New survey button */}
        {/* TODO: Add RBAC permission check - only show this button to admin users */}
        {/* When implementing: const { hasPermission } = useAuth(); */}
        {/* Then conditionally render: {hasPermission('create_survey') && <Button.../>} */}
        <Stack direction="row" justifyContent="flex-end" alignItems="center">
          <Button
            variant="contained"
            size="medium"
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

      {/* Surveys Table */}
      <TableContainer
        component={Paper}
        sx={{
          boxShadow: 'none',
          border: '1px solid',
          borderColor: 'divider'
        }}
      >
        <Table sx={{ minWidth: 650 }}>
          {/* Table Header */}
          <TableHead>
            <TableRow sx={{ bgcolor: 'grey.50' }}>
              <TableCell
                sx={{
                  fontWeight: 500,
                  fontSize: tableSizing.header.fontSize,
                  color: 'text.secondary',
                  textTransform: 'uppercase',
                  letterSpacing: '0.3px',
                  py: tableSizing.header.py,
                  px: tableSizing.header.px,
                }}
              >
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  <CalendarToday sx={{ fontSize: tableSizing.header.iconSize }} />
                  <span>Date</span>
                </Stack>
              </TableCell>
              <TableCell
                sx={{
                  fontWeight: 500,
                  fontSize: tableSizing.header.fontSize,
                  color: 'text.secondary',
                  textTransform: 'uppercase',
                  letterSpacing: '0.3px',
                  py: tableSizing.header.py,
                  px: tableSizing.header.px,
                }}
              >
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  <Person sx={{ fontSize: tableSizing.header.iconSize }} />
                  <span>Surveyors</span>
                </Stack>
              </TableCell>
              <TableCell
                sx={{
                  fontWeight: 500,
                  fontSize: tableSizing.header.fontSize,
                  color: 'text.secondary',
                  textTransform: 'uppercase',
                  letterSpacing: '0.3px',
                  py: tableSizing.header.py,
                  px: tableSizing.header.px,
                }}
              >
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  <Visibility sx={{ fontSize: tableSizing.header.iconSize }} />
                  <span>Sightings</span>
                </Stack>
              </TableCell>
              <TableCell
                sx={{
                  fontWeight: 500,
                  fontSize: tableSizing.header.fontSize,
                  color: 'text.secondary',
                  textTransform: 'uppercase',
                  letterSpacing: '0.3px',
                  py: tableSizing.header.py,
                  px: tableSizing.header.px,
                }}
              >
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  <LocationOn sx={{ fontSize: tableSizing.header.iconSize }} />
                  <span>Location</span>
                </Stack>
              </TableCell>
            </TableRow>
          </TableHead>

          {/* Table Body - Survey Rows */}
          <TableBody>
            {surveys.map((survey) => (
              <TableRow
                key={survey.id}
                onClick={() => handleRowClick(survey.id)}
                sx={{
                  '&:hover': { bgcolor: 'grey.50' },
                  cursor: 'pointer',
                  borderBottom: '1px solid',
                  borderColor: 'divider'
                }}
              >
                {/* Date Column */}
                <TableCell sx={{ py: tableSizing.row.py, px: tableSizing.row.px, fontSize: tableSizing.row.fontSize }}>
                  {survey.date}
                </TableCell>

                {/* Surveyors Column - Avatar Stack */}
                <TableCell sx={{ py: tableSizing.row.py, px: tableSizing.row.px }}>
                  <Box sx={{ display: 'flex', justifyContent: 'flex-start' }}>
                    <AvatarGroup
                      max={4}
                      sx={{
                        '& .MuiAvatar-root': {
                          width: tableSizing.avatar.size,
                          height: tableSizing.avatar.size,
                          fontSize: tableSizing.avatar.fontSize,
                          bgcolor: 'text.secondary',
                          border: '2px solid white',
                        }
                      }}
                    >
                      {survey.surveyors.map((surveyor, idx) => (
                        <Tooltip key={idx} title={surveyor} arrow>
                          <Avatar alt={surveyor}>
                            {getInitials(surveyor)}
                          </Avatar>
                        </Tooltip>
                      ))}
                    </AvatarGroup>
                  </Box>
                </TableCell>

                {/* Sightings Column - Chips with Icons */}
                <TableCell sx={{ py: tableSizing.row.py, px: tableSizing.row.px }}>
                  <Stack direction="row" spacing={0.75}>
                    {survey.sightings.map((sighting, idx) => {
                      const colors = getSightingColors();

                      // Select icon based on sighting type
                      const icon = sighting.type === 'butterflies'
                        ? <ButterflyIcon sx={{ fontSize: tableSizing.chip.iconSize, mr: 0.5 }} />
                        : sighting.type === 'birds'
                        ? <BirdIcon sx={{ fontSize: tableSizing.chip.iconSize, mr: 0.5 }} />
                        : <MushroomIcon sx={{ fontSize: tableSizing.chip.iconSize, mr: 0.5 }} />;

                      return (
                        <Tooltip key={idx} title={`${capitalize(sighting.type)} - ${sighting.count}`} arrow>
                          <Chip
                            label={
                              <Box component="span" sx={{ display: 'flex', alignItems: 'center' }}>
                                {icon} {sighting.count}
                              </Box>
                            }
                            size="small"
                            sx={{
                              bgcolor: colors.bgcolor,
                              color: colors.color,
                              fontWeight: 500,
                              fontSize: tableSizing.chip.fontSize,
                              height: tableSizing.chip.height,
                              borderRadius: '4px',
                              '& .MuiChip-label': {
                                px: 1,
                                py: 0
                              }
                            }}
                          />
                        </Tooltip>
                      );
                    })}
                  </Stack>
                </TableCell>

                {/* Location Column */}
                <TableCell sx={{ py: tableSizing.row.py, px: tableSizing.row.px, fontSize: tableSizing.row.fontSize, color: 'text.secondary' }}>
                  {survey.location}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
