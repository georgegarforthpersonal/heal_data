/**
 * "Files & data" panel for a group: the survey type's downloadable reference
 * files (methodology PDFs, recording forms, ID sheets), plus an export of
 * every sighting this group's surveys recorded. Reference files are managed in
 * Edit Survey Type; this view is download-only.
 *
 * This is the shortest panel on the page, so it is the one that gets stretched
 * to its grid row. The export is pinned to the card's foot (`mt: 'auto'`) so
 * the slack lands between the files and the export and reads as a card footer
 * rather than as a void.
 */
import { useState } from 'react';
import { Box, Paper, Typography, ButtonBase, CircularProgress } from '@mui/material';
import { Download } from '@mui/icons-material';
import type { SurveyTypeFile } from '../../services/api';
import { surveyTypesAPI, exportAPI } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { formatFileSize } from '../../utils/fileBadges';
import FileTypeBadge from '../FileTypeBadge';
import { groupCardSx, groupColors } from '../../pages/groups/groupsTokens';

interface FilesPanelProps {
  surveyTypeId: number;
  surveyTypeName: string;
  files: SurveyTypeFile[];
  loading: boolean;
}

const rowSx = {
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  gap: 1.5,
  px: 2.25,
  py: 1.4,
  textAlign: 'left',
  '&:hover': { bgcolor: groupColors.page },
} as const;

export default function FilesPanel({ surveyTypeId, surveyTypeName, files, loading }: FilesPanelProps) {
  const toast = useToast();
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async (file: SurveyTypeFile) => {
    try {
      const { download_url } = await surveyTypesAPI.getFileDownloadUrl(surveyTypeId, file.id);
      window.open(download_url, '_blank', 'noopener');
    } catch {
      toast.error('Failed to get download link');
    }
  };

  const handleExport = async () => {
    setDownloading(true);
    try {
      await exportAPI.downloadRecordsBySurveyType(surveyTypeId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Download failed');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Paper sx={{ ...groupCardSx, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ px: 2.25, py: 1.75, borderBottom: `1px solid ${groupColors.divider}` }}>
        <Typography sx={{ fontSize: 15, fontWeight: 600, color: groupColors.textPrimary }}>
          Files &amp; data
        </Typography>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
          <CircularProgress size={20} />
        </Box>
      ) : files.length === 0 ? (
        <Box sx={{ px: 2.25, py: 3 }}>
          <Typography sx={{ fontSize: 13.5, color: groupColors.textMuted }}>
            No files yet.
          </Typography>
        </Box>
      ) : (
        files.map((file) => (
          <ButtonBase
            key={file.id}
            onClick={() => handleDownload(file)}
            sx={{ ...rowSx, borderTop: `1px solid ${groupColors.dividerInner}` }}
          >
            <FileTypeBadge filename={file.filename} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontSize: 13, fontWeight: 600, color: groupColors.textPrimary }} noWrap>
                {file.filename}
              </Typography>
              {file.size_bytes != null && (
                <Typography sx={{ fontSize: 11.5, color: '#999' }}>
                  {formatFileSize(file.size_bytes)}
                </Typography>
              )}
            </Box>
            <Download sx={{ fontSize: 18, color: '#9aa39a', flexShrink: 0 }} />
          </ButtonBase>
        ))
      )}

      <ButtonBase
        onClick={handleExport}
        disabled={downloading}
        sx={{ ...rowSx, mt: 'auto', borderTop: `1px solid ${groupColors.divider}` }}
      >
        <FileTypeBadge filename="records.xlsx" />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: 13, fontWeight: 600, color: groupColors.textPrimary }} noWrap>
            {surveyTypeName} sighting records
          </Typography>
          <Typography sx={{ fontSize: 11.5, color: '#999' }}>
            {downloading ? 'Preparing…' : 'Excel · species, count, date, location'}
          </Typography>
        </Box>
        {downloading ? (
          <CircularProgress size={18} sx={{ color: '#9aa39a', flexShrink: 0 }} />
        ) : (
          <Download sx={{ fontSize: 18, color: '#9aa39a', flexShrink: 0 }} />
        )}
      </ButtonBase>
    </Paper>
  );
}
