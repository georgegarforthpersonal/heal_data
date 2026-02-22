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
  Tabs,
  Tab,
  FormControlLabel,
  Switch,
  Autocomplete,
  Stack,
} from '@mui/material';
import { Add, Delete, RestoreFromTrash, Edit, Lock } from '@mui/icons-material';
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  surveyorsAPI,
  surveyTypesAPI,
  locationsAPI,
  type Surveyor,
  type SurveyType,
  type SurveyTypeWithDetails,
  type SurveyTypeCreate,
  type SurveyTypeUpdate,
  type SpeciesTypeRef,
  type Location,
} from '../services/api';
import { SurveyTypeColorSelector, SurveyTypeChip } from '../components/SurveyTypeColors';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

/**
 * AdminPage - Admin management interface
 *
 * Features:
 * - Surveyors: View, add, deactivate/reactivate surveyors
 * - Survey Types: View, add, edit, deactivate/reactivate survey type configurations
 */
export function AdminPage() {
  const { isAuthenticated, isLoading: authLoading, requireAuth } = useAuth();
  const [tabValue, setTabValue] = useState(0);

  // Surveyors state
  const [surveyors, setSurveyors] = useState<Surveyor[]>([]);
  const [surveyorsLoading, setSurveyorsLoading] = useState(true);
  const [surveyorsError, setSurveyorsError] = useState<string | null>(null);
  const [surveyorDialogOpen, setSurveyorDialogOpen] = useState(false);
  const [surveyorDialogMode, setSurveyorDialogMode] = useState<'add' | 'edit'>('add');
  const [editingSurveyor, setEditingSurveyor] = useState<Surveyor | null>(null);
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [surveyorFormError, setSurveyorFormError] = useState<string | null>(null);
  const [savingSurveyor, setSavingSurveyor] = useState(false);
  const [deactivateSurveyorDialogOpen, setDeactivateSurveyorDialogOpen] = useState(false);
  const [surveyorToDeactivate, setSurveyorToDeactivate] = useState<Surveyor | null>(null);
  const [deactivatingSurveyor, setDeactivatingSurveyor] = useState(false);

  // Survey Types state
  const [surveyTypes, setSurveyTypes] = useState<SurveyType[]>([]);
  const [surveyTypesLoading, setSurveyTypesLoading] = useState(true);
  const [surveyTypesError, setSurveyTypesError] = useState<string | null>(null);
  const [allLocations, setAllLocations] = useState<Location[]>([]);
  const [allSpeciesTypes, setAllSpeciesTypes] = useState<SpeciesTypeRef[]>([]);
  const [surveyTypeDialogOpen, setSurveyTypeDialogOpen] = useState(false);
  const [surveyTypeDialogMode, setSurveyTypeDialogMode] = useState<'add' | 'edit'>('add');
  const [editingSurveyType, setEditingSurveyType] = useState<SurveyTypeWithDetails | null>(null);
  const [surveyTypeFormError, setSurveyTypeFormError] = useState<string | null>(null);
  const [savingSurveyType, setSavingSurveyType] = useState(false);
  const [deactivateSurveyTypeDialogOpen, setDeactivateSurveyTypeDialogOpen] = useState(false);
  const [surveyTypeToDeactivate, setSurveyTypeToDeactivate] = useState<SurveyType | null>(null);
  const [deactivatingSurveyType, setDeactivatingSurveyType] = useState(false);

  // Survey Type form state
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formLocationAtSightingLevel, setFormLocationAtSightingLevel] = useState(false);
  const [formAllowGeolocation, setFormAllowGeolocation] = useState(true);
  const [formAllowSightingNotes, setFormAllowSightingNotes] = useState(true);
  const [formAllowAudioUpload, setFormAllowAudioUpload] = useState(false);
  const [formColor, setFormColor] = useState<string | null>(null);
  const [formSelectedLocations, setFormSelectedLocations] = useState<Location[]>([]);
  const [formSelectedSpeciesTypes, setFormSelectedSpeciesTypes] = useState<SpeciesTypeRef[]>([]);

  // Load data
  useEffect(() => {
    loadSurveyors();
    loadSurveyTypes();
    loadReferenceData();
  }, []);

  const loadSurveyors = async () => {
    try {
      setSurveyorsLoading(true);
      setSurveyorsError(null);
      const data = await surveyorsAPI.getAll(true);
      setSurveyors(data);
    } catch (err) {
      setSurveyorsError(err instanceof Error ? err.message : 'Failed to load surveyors');
    } finally {
      setSurveyorsLoading(false);
    }
  };

  const loadSurveyTypes = async () => {
    try {
      setSurveyTypesLoading(true);
      setSurveyTypesError(null);
      const data = await surveyTypesAPI.getAll(true);
      setSurveyTypes(data);
    } catch (err) {
      setSurveyTypesError(err instanceof Error ? err.message : 'Failed to load survey types');
    } finally {
      setSurveyTypesLoading(false);
    }
  };

  const loadReferenceData = async () => {
    try {
      const [locations, speciesTypes] = await Promise.all([
        locationsAPI.getAll(),
        surveyTypesAPI.getSpeciesTypes(),
      ]);
      setAllLocations(locations);
      setAllSpeciesTypes(speciesTypes);
    } catch (err) {
      console.error('Failed to load reference data:', err);
    }
  };

  // Surveyor handlers
  const handleOpenAddSurveyor = () => {
    setSurveyorDialogMode('add');
    setEditingSurveyor(null);
    setNewFirstName('');
    setNewLastName('');
    setSurveyorFormError(null);
    setSurveyorDialogOpen(true);
  };

  const handleOpenEditSurveyor = (surveyor: Surveyor) => {
    setSurveyorDialogMode('edit');
    setEditingSurveyor(surveyor);
    setNewFirstName(surveyor.first_name);
    setNewLastName(surveyor.last_name || '');
    setSurveyorFormError(null);
    setSurveyorDialogOpen(true);
  };

  const handleSaveSurveyor = async () => {
    if (!newFirstName.trim()) {
      setSurveyorFormError('First name is required');
      return;
    }
    try {
      setSavingSurveyor(true);
      setSurveyorFormError(null);
      const data = {
        first_name: newFirstName.trim(),
        last_name: newLastName.trim() || null
      };
      if (surveyorDialogMode === 'add') {
        await surveyorsAPI.create(data);
      } else if (editingSurveyor) {
        await surveyorsAPI.update(editingSurveyor.id, data);
      }
      setSurveyorDialogOpen(false);
      await loadSurveyors();
    } catch (err) {
      setSurveyorFormError(err instanceof Error ? err.message : 'Failed to save surveyor');
    } finally {
      setSavingSurveyor(false);
    }
  };

  const handleDeactivateSurveyor = async () => {
    if (!surveyorToDeactivate) return;
    try {
      setDeactivatingSurveyor(true);
      await surveyorsAPI.deactivate(surveyorToDeactivate.id);
      setDeactivateSurveyorDialogOpen(false);
      setSurveyorToDeactivate(null);
      await loadSurveyors();
    } catch (err) {
      setSurveyorsError(err instanceof Error ? err.message : 'Failed to deactivate surveyor');
    } finally {
      setDeactivatingSurveyor(false);
    }
  };

  const handleReactivateSurveyor = async (surveyor: Surveyor) => {
    try {
      setSurveyorsError(null);
      await surveyorsAPI.reactivate(surveyor.id);
      await loadSurveyors();
    } catch (err) {
      setSurveyorsError(err instanceof Error ? err.message : 'Failed to reactivate surveyor');
    }
  };

  // Survey Type handlers
  const handleOpenAddSurveyType = () => {
    setSurveyTypeDialogMode('add');
    setEditingSurveyType(null);
    resetSurveyTypeForm();
    setSurveyTypeDialogOpen(true);
  };

  const handleOpenEditSurveyType = async (surveyType: SurveyType) => {
    try {
      const details = await surveyTypesAPI.getById(surveyType.id);
      setSurveyTypeDialogMode('edit');
      setEditingSurveyType(details);
      setFormName(details.name);
      setFormDescription(details.description || '');
      setFormLocationAtSightingLevel(details.location_at_sighting_level);
      setFormAllowGeolocation(details.allow_geolocation);
      setFormAllowSightingNotes(details.allow_sighting_notes);
      setFormAllowAudioUpload(details.allow_audio_upload);
      setFormColor(details.color);
      setFormSelectedLocations(details.locations);
      setFormSelectedSpeciesTypes(details.species_types);
      setSurveyTypeDialogOpen(true);
    } catch (err) {
      setSurveyTypesError(err instanceof Error ? err.message : 'Failed to load survey type details');
    }
  };

  const resetSurveyTypeForm = () => {
    setFormName('');
    setFormDescription('');
    setFormLocationAtSightingLevel(false);
    setFormAllowGeolocation(true);
    setFormAllowSightingNotes(true);
    setFormAllowAudioUpload(false);
    setFormColor(null);
    setFormSelectedLocations([]);
    setFormSelectedSpeciesTypes([]);
    setSurveyTypeFormError(null);
  };

  const handleSaveSurveyType = async () => {
    if (!formName.trim()) {
      setSurveyTypeFormError('Name is required');
      return;
    }
    if (formSelectedLocations.length === 0) {
      setSurveyTypeFormError('At least one location must be selected');
      return;
    }
    if (formSelectedSpeciesTypes.length === 0) {
      setSurveyTypeFormError('At least one species type must be selected');
      return;
    }

    try {
      setSavingSurveyType(true);
      setSurveyTypeFormError(null);

      const data = {
        name: formName.trim(),
        description: formDescription.trim() || undefined,
        location_at_sighting_level: formLocationAtSightingLevel,
        allow_geolocation: formAllowGeolocation,
        allow_sighting_notes: formAllowSightingNotes,
        allow_audio_upload: formAllowAudioUpload,
        color: formColor || undefined,
        location_ids: formSelectedLocations.map((l) => l.id),
        species_type_ids: formSelectedSpeciesTypes.map((st) => st.id),
      };

      if (surveyTypeDialogMode === 'add') {
        await surveyTypesAPI.create(data as SurveyTypeCreate);
      } else if (editingSurveyType) {
        await surveyTypesAPI.update(editingSurveyType.id, data as SurveyTypeUpdate);
      }

      setSurveyTypeDialogOpen(false);
      resetSurveyTypeForm();
      await loadSurveyTypes();
    } catch (err) {
      setSurveyTypeFormError(err instanceof Error ? err.message : 'Failed to save survey type');
    } finally {
      setSavingSurveyType(false);
    }
  };

  const handleDeactivateSurveyType = async () => {
    if (!surveyTypeToDeactivate) return;
    try {
      setDeactivatingSurveyType(true);
      await surveyTypesAPI.delete(surveyTypeToDeactivate.id);
      setDeactivateSurveyTypeDialogOpen(false);
      setSurveyTypeToDeactivate(null);
      await loadSurveyTypes();
    } catch (err) {
      setSurveyTypesError(err instanceof Error ? err.message : 'Failed to deactivate survey type');
    } finally {
      setDeactivatingSurveyType(false);
    }
  };

  const handleReactivateSurveyType = async (surveyType: SurveyType) => {
    try {
      setSurveyTypesError(null);
      await surveyTypesAPI.reactivate(surveyType.id);
      await loadSurveyTypes();
    } catch (err) {
      setSurveyTypesError(err instanceof Error ? err.message : 'Failed to reactivate survey type');
    }
  };

  // Show auth gate if not authenticated
  if (authLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!isAuthenticated) {
    return (
      <Box sx={{ p: { xs: 2, sm: 3, md: 4 }, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}>
        <Lock sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
        <Typography variant="h6" sx={{ mb: 1 }}>
          Admin Access Required
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3, textAlign: 'center' }}>
          You need to enter the admin password to access this page.
        </Typography>
        <Button
          variant="contained"
          onClick={() => requireAuth(() => {})}
          sx={{ bgcolor: '#8B8AC7', '&:hover': { bgcolor: '#7A79B6' } }}
        >
          Enter Password
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)}>
          <Tab label="Surveyors" />
          <Tab label="Survey Types" />
        </Tabs>
      </Box>

      {/* Surveyors Tab */}
      <TabPanel value={tabValue} index={0}>
        <Box sx={{ mb: 3, display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={handleOpenAddSurveyor}
            sx={{ bgcolor: '#8B8AC7', '&:hover': { bgcolor: '#7A79B6' } }}
          >
            Add Surveyor
          </Button>
        </Box>

        {surveyorsError && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setSurveyorsError(null)}>
            {surveyorsError}
          </Alert>
        )}

        <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {surveyorsLoading ? (
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
                        {surveyor.first_name}{surveyor.last_name ? ` ${surveyor.last_name}` : ''}
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
                      <IconButton
                        size="small"
                        onClick={() => handleOpenEditSurveyor(surveyor)}
                        sx={{ color: 'primary.main', mr: 1 }}
                        title="Edit"
                      >
                        <Edit />
                      </IconButton>
                      {surveyor.is_active ? (
                        <IconButton
                          size="small"
                          onClick={() => {
                            setSurveyorToDeactivate(surveyor);
                            setDeactivateSurveyorDialogOpen(true);
                          }}
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
      </TabPanel>

      {/* Survey Types Tab */}
      <TabPanel value={tabValue} index={1}>
        <Box sx={{ mb: 3, display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={handleOpenAddSurveyType}
            sx={{ bgcolor: '#8B8AC7', '&:hover': { bgcolor: '#7A79B6' } }}
          >
            Add Survey Type
          </Button>
        </Box>

        {surveyTypesError && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setSurveyTypesError(null)}>
            {surveyTypesError}
          </Alert>
        )}

        <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Location Level</TableCell>
                <TableCell>Geolocation</TableCell>
                <TableCell>Sighting Notes</TableCell>
                <TableCell>Audio</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {surveyTypesLoading ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 8 }}>
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : surveyTypes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 8, color: 'text.secondary' }}>
                    No survey types found
                  </TableCell>
                </TableRow>
              ) : (
                surveyTypes.map((surveyType) => (
                  <TableRow key={surveyType.id} sx={{ '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.02)' } }}>
                    <TableCell>
                      <Stack direction="row" alignItems="center" spacing={1.5}>
                        <SurveyTypeChip name={surveyType.name} color={surveyType.color} />
                        {surveyType.description && (
                          <Typography variant="body2" color="text.secondary">
                            {surveyType.description}
                          </Typography>
                        )}
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={surveyType.location_at_sighting_level ? 'Per Sighting' : 'Per Survey'}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={surveyType.allow_geolocation ? 'Enabled' : 'Disabled'}
                        size="small"
                        color={surveyType.allow_geolocation ? 'info' : 'default'}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={surveyType.allow_sighting_notes ? 'Enabled' : 'Disabled'}
                        size="small"
                        color={surveyType.allow_sighting_notes ? 'warning' : 'default'}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={surveyType.allow_audio_upload ? 'Enabled' : 'Disabled'}
                        size="small"
                        color={surveyType.allow_audio_upload ? 'secondary' : 'default'}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={surveyType.is_active ? 'Active' : 'Inactive'}
                        size="small"
                        color={surveyType.is_active ? 'success' : 'default'}
                        sx={{ minWidth: 70 }}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <IconButton
                        size="small"
                        onClick={() => handleOpenEditSurveyType(surveyType)}
                        sx={{ color: 'primary.main', mr: 1 }}
                        title="Edit"
                      >
                        <Edit />
                      </IconButton>
                      {surveyType.is_active ? (
                        <IconButton
                          size="small"
                          onClick={() => {
                            setSurveyTypeToDeactivate(surveyType);
                            setDeactivateSurveyTypeDialogOpen(true);
                          }}
                          sx={{ color: 'error.main' }}
                          title="Deactivate"
                        >
                          <Delete />
                        </IconButton>
                      ) : (
                        <IconButton
                          size="small"
                          onClick={() => handleReactivateSurveyType(surveyType)}
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
      </TabPanel>

      {/* Add/Edit Surveyor Dialog */}
      <Dialog open={surveyorDialogOpen} onClose={() => !savingSurveyor && setSurveyorDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{surveyorDialogMode === 'add' ? 'Add New Surveyor' : 'Edit Surveyor'}</DialogTitle>
        <DialogContent>
          {surveyorFormError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {surveyorFormError}
            </Alert>
          )}
          <TextField
            autoFocus
            margin="normal"
            label="First Name"
            fullWidth
            value={newFirstName}
            onChange={(e) => setNewFirstName(e.target.value)}
            disabled={savingSurveyor}
          />
          <TextField
            margin="normal"
            label="Last Name"
            fullWidth
            value={newLastName}
            onChange={(e) => setNewLastName(e.target.value)}
            disabled={savingSurveyor}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSurveyorDialogOpen(false)} disabled={savingSurveyor}>
            Cancel
          </Button>
          <Button
            onClick={handleSaveSurveyor}
            variant="contained"
            disabled={savingSurveyor}
            sx={{ bgcolor: '#8B8AC7', '&:hover': { bgcolor: '#7A79B6' } }}
          >
            {savingSurveyor ? 'Saving...' : surveyorDialogMode === 'add' ? 'Add' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Deactivate Surveyor Dialog */}
      <Dialog
        open={deactivateSurveyorDialogOpen}
        onClose={() => !deactivatingSurveyor && setDeactivateSurveyorDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Deactivate Surveyor?</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to deactivate{' '}
            <strong>
              {surveyorToDeactivate?.first_name}{surveyorToDeactivate?.last_name ? ` ${surveyorToDeactivate.last_name}` : ''}
            </strong>
            ?
          </Typography>
          <Typography sx={{ mt: 2, color: 'text.secondary' }}>
            They will no longer appear in the surveyor list for new surveys, but their historical survey data will be preserved.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeactivateSurveyorDialogOpen(false)} disabled={deactivatingSurveyor}>
            Cancel
          </Button>
          <Button onClick={handleDeactivateSurveyor} variant="contained" color="error" disabled={deactivatingSurveyor}>
            {deactivatingSurveyor ? 'Deactivating...' : 'Deactivate'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add/Edit Survey Type Dialog */}
      <Dialog
        open={surveyTypeDialogOpen}
        onClose={() => !savingSurveyType && setSurveyTypeDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>{surveyTypeDialogMode === 'add' ? 'Add New Survey Type' : 'Edit Survey Type'}</DialogTitle>
        <DialogContent>
          {surveyTypeFormError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {surveyTypeFormError}
            </Alert>
          )}
          <TextField
            autoFocus
            margin="normal"
            label="Name"
            fullWidth
            required
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            disabled={savingSurveyType}
          />
          <TextField
            margin="normal"
            label="Description"
            fullWidth
            multiline
            rows={2}
            value={formDescription}
            onChange={(e) => setFormDescription(e.target.value)}
            disabled={savingSurveyType}
          />
          <Box sx={{ mt: 2 }}>
            <SurveyTypeColorSelector
              value={formColor}
              onChange={setFormColor}
            />
          </Box>
          <Box sx={{ mt: 2 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={formLocationAtSightingLevel}
                  onChange={(e) => setFormLocationAtSightingLevel(e.target.checked)}
                  disabled={savingSurveyType}
                />
              }
              label="Location at sighting level"
            />
            <Typography variant="caption" color="text.secondary" display="block" sx={{ ml: 4, mt: -1 }}>
              {formLocationAtSightingLevel
                ? 'Each sighting can have its own location'
                : 'Location is set once for the entire survey'}
            </Typography>
          </Box>
          <Box sx={{ mt: 2 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={formAllowGeolocation}
                  onChange={(e) => setFormAllowGeolocation(e.target.checked)}
                  disabled={savingSurveyType}
                />
              }
              label="Allow geolocation"
            />
            <Typography variant="caption" color="text.secondary" display="block" sx={{ ml: 4, mt: -1 }}>
              {formAllowGeolocation
                ? 'Users can add GPS coordinates to sightings'
                : 'GPS coordinates are disabled for this survey type'}
            </Typography>
          </Box>
          <Box sx={{ mt: 2 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={formAllowSightingNotes}
                  onChange={(e) => setFormAllowSightingNotes(e.target.checked)}
                  disabled={savingSurveyType}
                />
              }
              label="Allow sighting notes"
            />
            <Typography variant="caption" color="text.secondary" display="block" sx={{ ml: 4, mt: -1 }}>
              {formAllowSightingNotes
                ? 'Users can add notes to individual sightings'
                : 'Sighting notes are disabled for this survey type'}
            </Typography>
          </Box>
          <Box sx={{ mt: 2 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={formAllowAudioUpload}
                  onChange={(e) => setFormAllowAudioUpload(e.target.checked)}
                  disabled={savingSurveyType}
                />
              }
              label="Allow audio upload"
            />
            <Typography variant="caption" color="text.secondary" display="block" sx={{ ml: 4, mt: -1 }}>
              {formAllowAudioUpload
                ? 'Users can upload audio files for analysis'
                : 'Audio upload is disabled for this survey type'}
            </Typography>
          </Box>
          <Autocomplete
            multiple
            options={allLocations}
            getOptionLabel={(option) => option.name}
            value={formSelectedLocations}
            onChange={(_, newValue) => setFormSelectedLocations(newValue)}
            disabled={savingSurveyType}
            renderInput={(params) => (
              <TextField {...params} margin="normal" label="Available Locations" placeholder="Select locations" required />
            )}
            sx={{ mt: 2 }}
          />
          <Autocomplete
            multiple
            options={allSpeciesTypes}
            getOptionLabel={(option) => option.display_name}
            value={formSelectedSpeciesTypes}
            onChange={(_, newValue) => setFormSelectedSpeciesTypes(newValue)}
            disabled={savingSurveyType}
            renderInput={(params) => (
              <TextField {...params} margin="normal" label="Species Types" placeholder="Select species types" required />
            )}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSurveyTypeDialogOpen(false)} disabled={savingSurveyType}>
            Cancel
          </Button>
          <Button
            onClick={handleSaveSurveyType}
            variant="contained"
            disabled={savingSurveyType}
            sx={{ bgcolor: '#8B8AC7', '&:hover': { bgcolor: '#7A79B6' } }}
          >
            {savingSurveyType ? 'Saving...' : surveyTypeDialogMode === 'add' ? 'Add' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Deactivate Survey Type Dialog */}
      <Dialog
        open={deactivateSurveyTypeDialogOpen}
        onClose={() => !deactivatingSurveyType && setDeactivateSurveyTypeDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Deactivate Survey Type?</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to deactivate <strong>{surveyTypeToDeactivate?.name}</strong>?
          </Typography>
          <Typography sx={{ mt: 2, color: 'text.secondary' }}>
            It will no longer be available for new surveys, but existing surveys using this type will be preserved.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeactivateSurveyTypeDialogOpen(false)} disabled={deactivatingSurveyType}>
            Cancel
          </Button>
          <Button onClick={handleDeactivateSurveyType} variant="contained" color="error" disabled={deactivatingSurveyType}>
            {deactivatingSurveyType ? 'Deactivating...' : 'Deactivate'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
