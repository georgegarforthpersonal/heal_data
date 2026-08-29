import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material';

interface UnsavedChangesDialogProps {
  open: boolean;
  /** Stay on the page and keep the in-progress work */
  onKeepWorking: () => void;
  /** Leave the page, discarding the in-progress work */
  onDiscard: () => void;
}

/**
 * Confirmation dialog shown when the user tries to leave a page with
 * unsaved work (see useUnsavedChangesGuard).
 */
export function UnsavedChangesDialog({ open, onKeepWorking, onDiscard }: UnsavedChangesDialogProps) {
  return (
    <Dialog open={open} onClose={onKeepWorking}>
      <DialogTitle>Discard unsaved work?</DialogTitle>
      <DialogContent>
        <DialogContentText>
          Your progress has not been saved. If you leave this page now, it will be lost.
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        {/* No autoFocus: it paints the focus-visible ripple as a stray halo
            around the button on touch screens (GEO-36). */}
        <Button onClick={onKeepWorking} variant="contained" sx={{ textTransform: 'none' }}>
          Keep working
        </Button>
        <Button onClick={onDiscard} color="error" sx={{ textTransform: 'none' }}>
          Discard
        </Button>
      </DialogActions>
    </Dialog>
  );
}
