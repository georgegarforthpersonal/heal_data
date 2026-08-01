/**
 * Data panel for a group: opens the in-app sighting records table (species,
 * count, date, location) for this group's survey type. The Excel download
 * lives on that records page, so phones without a spreadsheet app are never
 * handed a bare .xlsx file.
 */
import { Box, Paper, Typography, ButtonBase } from '@mui/material';
import { ChevronRight, TableRows } from '@mui/icons-material';
import { groupCardSx, groupColors } from '../../pages/groups/groupsTokens';

interface DataPanelProps {
  surveyTypeName: string;
  /** Navigate to the group's sighting-records page. */
  onOpen: () => void;
}

export default function DataPanel({ surveyTypeName, onOpen }: DataPanelProps) {
  return (
    <Paper sx={groupCardSx}>
      <Box sx={{ px: 2.25, py: 1.75, borderBottom: `1px solid ${groupColors.divider}` }}>
        <Typography sx={{ fontSize: 15, fontWeight: 600, color: groupColors.textPrimary }}>
          Data
        </Typography>
      </Box>

      <ButtonBase
        onClick={onOpen}
        sx={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: 2.25,
          py: 1.4,
          textAlign: 'left',
          '&:hover': { bgcolor: groupColors.page },
        }}
      >
        {/* Tile sized to match FileTypeBadge so Data and Files rows align. */}
        <Box
          sx={{
            width: 34,
            height: 40,
            borderRadius: '5px',
            bgcolor: '#DBEDDB',
            color: '#2E6B42',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <TableRows sx={{ fontSize: 18 }} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: 13, fontWeight: 600, color: groupColors.textPrimary }} noWrap>
            {surveyTypeName} sighting records
          </Typography>
          <Typography sx={{ fontSize: 11.5, color: '#999' }}>
            Species, count, date, location · Excel download
          </Typography>
        </Box>
        <ChevronRight sx={{ fontSize: 20, color: '#9aa39a', flexShrink: 0 }} />
      </ButtonBase>
    </Paper>
  );
}
