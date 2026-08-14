/**
 * Files panel for a group: a short list of downloadable reference files
 * (methodology PDFs, recording forms, ID sheets) attached to the survey type.
 * Files are managed in Edit Survey Type; this view is download-only.
 * A failed files fetch renders as a failure with Retry — never as
 * "No files yet", which reads as an instruction to re-upload.
 */
import { Box, Paper, Typography, Button, ButtonBase, CircularProgress } from '@mui/material';
import { Download } from '@mui/icons-material';
import type { SurveyTypeFile } from '../../services/api';
import { surveyTypesAPI } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { formatFileSize } from '../../utils/fileBadges';
import FileTypeBadge from '../FileTypeBadge';
import { groupCardSx, groupColors, panelTitleSx } from '../../pages/groups/groupsTokens';

interface FilesPanelProps {
  surveyTypeId: number;
  files: SurveyTypeFile[];
  loading: boolean;
  /** The files fetch failed — show a retry, not an empty state. */
  error?: boolean;
  onRetry?: () => void;
}

export default function FilesPanel({ surveyTypeId, files, loading, error = false, onRetry }: FilesPanelProps) {
  const toast = useToast();

  const handleDownload = async (file: SurveyTypeFile) => {
    // Open the tab inside the click gesture — popup blockers (iOS Safari
    // especially) eat a window.open that happens after an await, which made
    // the tap silently do nothing.
    const tab = window.open('', '_blank', 'noopener');
    try {
      const { download_url } = await surveyTypesAPI.getFileDownloadUrl(surveyTypeId, file.id);
      if (tab) tab.location.href = download_url;
      else window.location.href = download_url;
    } catch {
      tab?.close();
      toast.error('Couldn’t get the download link — try again');
    }
  };

  return (
    <Paper sx={groupCardSx}>
      <Box sx={{ px: 2.25, py: 1.75, borderBottom: `1px solid ${groupColors.divider}` }}>
        <Typography component="h2" sx={panelTitleSx}>
          Files
        </Typography>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
          <CircularProgress size={20} />
        </Box>
      ) : error ? (
        <Box sx={{ px: 2.25, py: 3, display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Typography sx={{ fontSize: 13.5, color: groupColors.textMuted }}>
            Couldn’t load the files.
          </Typography>
          {onRetry && (
            <Button size="small" onClick={onRetry} sx={{ textTransform: 'none', color: groupColors.brandDark, fontWeight: 600 }}>
              Retry
            </Button>
          )}
        </Box>
      ) : files.length === 0 ? (
        <Box sx={{ px: 2.25, py: 3 }}>
          <Typography sx={{ fontSize: 13.5, color: groupColors.textMuted }}>
            No files yet. Admins can attach ID sheets and recording forms in
            Edit survey type.
          </Typography>
        </Box>
      ) : (
        files.map((file) => (
          <ButtonBase
            key={file.id}
            onClick={() => handleDownload(file)}
            sx={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              px: 2.25,
              py: 1.4,
              borderTop: `1px solid ${groupColors.dividerInner}`,
              textAlign: 'left',
              '&:hover': { bgcolor: groupColors.page },
            }}
          >
            <FileTypeBadge filename={file.filename} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontSize: 13, fontWeight: 600, color: groupColors.textPrimary }} noWrap>
                {file.filename}
              </Typography>
              {file.size_bytes != null && (
                <Typography sx={{ fontSize: 11.5, color: groupColors.textMuted }}>
                  {formatFileSize(file.size_bytes)}
                </Typography>
              )}
            </Box>
            <Download sx={{ fontSize: 18, color: groupColors.textMuted, flexShrink: 0 }} />
          </ButtonBase>
        ))
      )}
    </Paper>
  );
}
