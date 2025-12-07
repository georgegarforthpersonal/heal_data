import {
  Box,
  Typography,
  Paper,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  CircularProgress,
} from '@mui/material';
import { Add, Delete, RestoreFromTrash, Edit } from '@mui/icons-material';
import { useState, useEffect } from 'react';
import { surveyorsAPI, type Surveyor } from '../services/api';

/**
 * AdminPage - Surveyor management interface
 *
 * Features:
 * - View all surveyors with active/inactive status
 * - Add new surveyors
 * - Deactivate/Reactivate surveyors
 */
export function AdminPage() {
  const [surveyors, setSurveyors] = useState<Surveyor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add surveyor dialog
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  // Deactivate confirmation dialog
  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false);
  const [surveyorToDeactivate, setSurveyorToDeactivate] = useState<Surveyor | null>(null);
  const [deactivating, setDeactivating] = useState(false);

  // Load surveyors
  useEffect(() => {
    loadSurveyors();
  }, []);

  const loadSurveyors = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await surveyorsAPI.getAll(true); // Always include inactive surveyors
      setSurveyors(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load surveyors');
    } finally {
      setLoading(false);
    }
  };

  const handleAddSurveyor = async () => {
    if (!newFirstName.trim() || !newLastName.trim()) {
      setAddError('Both first name and last name are required');
      return;
    }

    try {
      setAdding(true);
      setAddError(null);
      await surveyorsAPI.create({
        first_name: newFirstName.trim(),
        last_name: newLastName.trim(),
      });

      // Reset form and close dialog
      setNewFirstName('');
      setNewLastName('');
      setAddDialogOpen(false);

      // Reload surveyors
      await loadSurveyors();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Failed to add surveyor');
    } finally {
      setAdding(false);
    }
  };

  const handleOpenDeactivateDialog = (surveyor: Surveyor) => {
    setSurveyorToDeactivate(surveyor);
    setDeactivateDialogOpen(true);
  };

  const handleDeactivateSurveyor = async () => {
    if (!surveyorToDeactivate) return;

    try {
      setDeactivating(true);
      await surveyorsAPI.deactivate(surveyorToDeactivate.id);
      setDeactivateDialogOpen(false);
      setSurveyorToDeactivate(null);
      await loadSurveyors();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to deactivate surveyor');
    } finally {
      setDeactivating(false);
    }
  };

  const handleReactivateSurveyor = async (surveyor: Surveyor) => {
    try {
      setError(null);
      await surveyorsAPI.reactivate(surveyor.id);
      await loadSurveyors();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reactivate surveyor');
    }
  };

  return (
    <Box sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 600 }}>
          Admin
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => setAddDialogOpen(true)}
          sx={{ bgcolor: '#8B8AC7', '&:hover': { bgcolor: '#7A79B6' } }}
        >
          Add Surveyor
        </Button>
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Surveyors Table */}
      <TableContainer
        component={Paper}
        elevation={0}
        sx={{
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={3} align="center" sx={{ py: 8 }}>
                  <CircularProgress />
                </TableCell>
              </TableRow>
            ) : surveyors.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} align="center" sx={{ py: 8, color: 'text.secondary' }}>
                  No surveyors found
                </TableCell>
              </TableRow>
            ) : (
              surveyors.map((surveyor) => (
                <TableRow key={surveyor.id} sx={{ '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.02)' } }}>
                  <TableCell>
                    <Typography variant="body1">
                      {surveyor.first_name} {surveyor.last_name}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={surveyor.is_active ? 'Active' : 'Inactive'}
                      size="small"
                      color={surveyor.is_active ? 'success' : 'default'}
                      sx={{ minWidth: 70 }}
                    />
                  </TableCell>
                  <TableCell align="right">
                    {surveyor.is_active ? (
                      <IconButton
                        size="small"
                        onClick={() => handleOpenDeactivateDialog(surveyor)}
                        sx={{ color: 'error.main' }}
                        title="Deactivate"
                      >
                        <Delete />
                      </IconButton>
                    ) : (
                      <IconButton
                        size="small"
                        onClick={() => handleReactivateSurveyor(surveyor)}
                        sx={{ color: 'success.main' }}
                        title="Reactivate"
                      >
                        <RestoreFromTrash />
                      </IconButton>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Add Surveyor Dialog */}
      <Dialog open={addDialogOpen} onClose={() => !adding && setAddDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add New Surveyor</DialogTitle>
        <DialogContent>
          {addError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {addError}
            </Alert>
          )}
          <TextField
            autoFocus
            margin="normal"
            label="First Name"
            fullWidth
            value={newFirstName}
            onChange={(e) => setNewFirstName(e.target.value)}
            disabled={adding}
          />
          <TextField
            margin="normal"
            label="Last Name"
            fullWidth
            value={newLastName}
            onChange={(e) => setNewLastName(e.target.value)}
            disabled={adding}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddDialogOpen(false)} disabled={adding}>
            Cancel
          </Button>
          <Button
            onClick={handleAddSurveyor}
            variant="contained"
            disabled={adding}
            sx={{ bgcolor: '#8B8AC7', '&:hover': { bgcolor: '#7A79B6' } }}
          >
            {adding ? 'Adding...' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Deactivate Confirmation Dialog */}
      <Dialog
        open={deactivateDialogOpen}
        onClose={() => !deactivating && setDeactivateDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Deactivate Surveyor?</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to deactivate{' '}
            <strong>
              {surveyorToDeactivate?.first_name} {surveyorToDeactivate?.last_name}
            </strong>
            ?
          </Typography>
          <Typography sx={{ mt: 2, color: 'text.secondary' }}>
            They will no longer appear in the surveyor list for new surveys, but their historical
            survey data will be preserved.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeactivateDialogOpen(false)} disabled={deactivating}>
            Cancel
          </Button>
          <Button
            onClick={handleDeactivateSurveyor}
            variant="contained"
            color="error"
            disabled={deactivating}
          >
            {deactivating ? 'Deactivating...' : 'Deactivate'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
