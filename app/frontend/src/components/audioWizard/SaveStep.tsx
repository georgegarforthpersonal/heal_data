import {
  Typography,
  Paper,
  Button,
  Alert,
  CircularProgress,
  LinearProgress,
} from '@mui/material';
import { CheckCircle } from '@mui/icons-material';
import type { AudioWizardState } from '../../hooks/useAudioWizard';

interface SaveStepProps {
  wizard: AudioWizardState;
}

export function SaveStep({ wizard }: SaveStepProps) {
  const { saving, saveProgress, error, setError, handleSave } = wizard;

  return (
    <Paper sx={{ p: 3, textAlign: 'center', boxShadow: 'none', border: '1px solid', borderColor: 'divider' }}>
      {saving ? (
        <>
          <CircularProgress sx={{ mb: 2 }} />
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
            {saveProgress.step}
          </Typography>
          <LinearProgress
            variant="determinate"
            value={saveProgress.percent}
            sx={{ height: 8, borderRadius: 4, maxWidth: 400, mx: 'auto' }}
          />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {saveProgress.percent}%
          </Typography>
        </>
      ) : error ? (
        <>
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
          <Button
            variant="contained"
            onClick={() => { setError(null); handleSave(); }}
            sx={{ textTransform: 'none' }}
          >
            Retry
          </Button>
        </>
      ) : (
        <>
          <CheckCircle sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
          <Typography variant="h6">Survey saved successfully!</Typography>
        </>
      )}
    </Paper>
  );
}
