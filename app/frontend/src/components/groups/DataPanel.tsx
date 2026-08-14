/**
 * Data panel for a group: download every sighting recorded by this group's
 * surveys as an Excel spreadsheet (common name, species, count, date,
 * location). Mirrors the admin Data tab export, scoped to one survey type.
 * With nothing recorded the download is disabled and says why — never a
 * surprise empty spreadsheet.
 */
import { useState } from 'react';
import { Box, Paper, Typography, ButtonBase, CircularProgress } from '@mui/material';
import { Download } from '@mui/icons-material';
import { exportAPI } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import FileTypeBadge from '../FileTypeBadge';
import { groupCardSx, groupColors, panelTitleSx } from '../../pages/groups/groupsTokens';

interface DataPanelProps {
  surveyTypeId: number;
  surveyTypeName: string;
  /** Recorded surveys total — 0 disables the export (nothing to download). */
  recordedCount?: number;
}

export default function DataPanel({ surveyTypeId, surveyTypeName, recordedCount }: DataPanelProps) {
  const toast = useToast();
  const [downloading, setDownloading] = useState(false);
  const empty = recordedCount === 0;

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await exportAPI.downloadRecordsBySurveyType(surveyTypeId);
    } catch {
      toast.error('Couldn’t prepare the download — try again');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Paper sx={groupCardSx}>
      <Box sx={{ px: 2.25, py: 1.75, borderBottom: `1px solid ${groupColors.divider}` }}>
        <Typography component="h2" sx={panelTitleSx}>
          Data
        </Typography>
      </Box>

      <ButtonBase
        onClick={handleDownload}
        disabled={downloading || empty}
        sx={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: 2.25,
          py: 1.4,
          textAlign: 'left',
          opacity: empty ? 0.55 : 1,
          '&:hover': { bgcolor: empty ? 'transparent' : groupColors.page },
        }}
      >
        <FileTypeBadge filename="records.xlsx" />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: 13, fontWeight: 600, color: groupColors.textPrimary }} noWrap>
            {surveyTypeName} sighting records
          </Typography>
          <Typography sx={{ fontSize: 11.5, color: groupColors.textMuted }}>
            {empty
              ? 'Nothing recorded yet — the export unlocks with the first survey'
              : downloading
                ? 'Preparing your spreadsheet…'
                : 'Excel · species, count, date, location'}
          </Typography>
        </Box>
        {downloading ? (
          <CircularProgress size={18} sx={{ color: groupColors.textMuted, flexShrink: 0 }} />
        ) : (
          <Download sx={{ fontSize: 18, color: groupColors.textMuted, flexShrink: 0 }} />
        )}
      </ButtonBase>
    </Paper>
  );
}
