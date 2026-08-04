/**
 * Admin locations + devices view: a map (device markers over location
 * boundaries) or a filterable table listing both kinds, with full editing
 * (add / edit / delete / (de)activate). The read-only space panel uses
 * DeviceMap directly instead.
 *
 * Data loading lives in the caller (LocationsDevicesManager); after a
 * successful mutation this calls `onReload` to refresh.
 */

import { useMemo, useState, type Ref } from 'react';
import {
  Box,
  Button,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  InputAdornment,
  ToggleButton,
  ToggleButtonGroup,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  IconButton,
  Typography,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from '@mui/material';
import { Add, Edit, Delete, RestoreFromTrash, Search } from '@mui/icons-material';
import PlaceIcon from '@mui/icons-material/Place';
import SensorsIcon from '@mui/icons-material/Sensors';

import { locationsAPI, devicesAPI, locationDisplayName } from '../../services/api';
import type { Location, LocationType, LocationWithBoundary, Device, SurveyTypeRef } from '../../services/api';
import { brandColors } from '../../theme';
import { useToast } from '../../context/ToastContext';
import { useRowHighlight } from '../../hooks';
import { useResponsive } from '../../hooks/useResponsive';
import { DEVICE_TYPE_LABELS, DEVICE_CHIP_COLORS } from '../../utils/deviceIcon';
import DeviceMap from './DeviceMap';
import LocationDeviceEditorDialog, { type EditorKind } from './LocationDeviceEditorDialog';
import ViewModeToggle, { type ViewMode } from '../ViewModeToggle';
import EntityCard from './EntityCard';

const LOCATION_TYPE_LABELS: Record<LocationType, string> = {
  area: 'Area',
  route: 'Route',
  point: 'Point',
  none: 'No coordinates',
  sector: 'Sector',
};

const LOCATION_TYPE_COLORS: Record<LocationType, 'success' | 'info' | 'warning' | 'default'> = {
  area: 'success',
  route: 'info',
  point: 'warning',
  none: 'default',
  sector: 'info',
};

type EntityKind = 'location' | 'device';

type Row =
  | { kind: 'location'; sortName: string; location: Location }
  | { kind: 'device'; sortName: string; device: Device };

const LOCATION_DEFAULTS = { geometry: null, boundary_geometry: null };

interface LocationsDevicesViewProps {
  /** Top-level locations to list (Location or LocationWithBoundary). */
  locations: Location[];
  /** Locations with geometry, drawn on the map. */
  boundaries: LocationWithBoundary[];
  devices: Device[];
  loading: boolean;
  loadError?: string | null;
  /** Called after a successful mutation so the caller can refresh its data. */
  onReload: () => Promise<void> | void;
}

export default function LocationsDevicesView({
  locations,
  boundaries,
  devices,
  loading,
  loadError = null,
  onReload,
}: LocationsDevicesViewProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [search, setSearch] = useState('');
  const [kindFilter, setKindFilter] = useState<'all' | EntityKind>('all');
  const [surveyTypeFilter, setSurveyTypeFilter] = useState<number | ''>('');

  // Editor dialog
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<'add' | 'edit'>('add');
  const [editorKind, setEditorKind] = useState<EditorKind>('location');
  const [editLocation, setEditLocation] = useState<LocationWithBoundary | null>(null);
  const [editDevice, setEditDevice] = useState<Device | null>(null);

  // Confirmation dialogs
  const [deleteLocationTarget, setDeleteLocationTarget] = useState<Location | null>(null);
  const [deletingLocation, setDeletingLocation] = useState(false);
  const [deactivateDeviceTarget, setDeactivateDeviceTarget] = useState<Device | null>(null);
  const [deactivatingDevice, setDeactivatingDevice] = useState(false);
  const [crudError, setCrudError] = useState<string | null>(null);

  const toast = useToast();
  const { isMobile } = useResponsive();
  const locationHighlight = useRowHighlight();
  const deviceHighlight = useRowHighlight();

  const boundariesById = useMemo(
    () => new Map(boundaries.map((b) => [b.id, b])),
    [boundaries],
  );

  // Survey types per top-level location. Sectors carry their own links, so a
  // route shows (and matches the filter on) the union of its own and its
  // sectors' survey types.
  const usedByLocation = useMemo(() => {
    const typesByLocationId = new Map(locations.map((l) => [l.id, l.survey_types ?? []]));
    const out = new Map<number, SurveyTypeRef[]>();
    for (const location of locations) {
      if (location.location_type === 'sector') continue;
      const byId = new Map((location.survey_types ?? []).map((st) => [st.id, st]));
      for (const sector of boundariesById.get(location.id)?.sectors ?? []) {
        for (const st of typesByLocationId.get(sector.id) ?? []) byId.set(st.id, st);
      }
      out.set(
        location.id,
        [...byId.values()].sort((a, b) => a.name.localeCompare(b.name)),
      );
    }
    return out;
  }, [locations, boundariesById]);

  // Filter options: only survey types with at least one linked location.
  // Types whose only links are device allocations are left out — they would
  // pad the dropdown without helping anyone find a location.
  const surveyTypeOptions = useMemo(() => {
    const byId = new Map<number, SurveyTypeRef>();
    for (const refs of usedByLocation.values()) for (const st of refs) byId.set(st.id, st);
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [usedByLocation]);

  /** Build the full location editor target, filling geometry defaults when absent. */
  const toLocationEditTarget = (location: Location): LocationWithBoundary => {
    const existing = boundariesById.get(location.id);
    if (existing) return existing;
    return {
      id: location.id,
      name: location.name,
      location_type: location.location_type ?? 'none',
      ...LOCATION_DEFAULTS,
    };
  };

  const handleAdd = () => {
    setEditorMode('add');
    setEditorKind('location');
    setEditLocation(null);
    setEditDevice(null);
    setEditorOpen(true);
  };

  const handleEditLocation = (location: Location) => {
    // Sectors are drawn and named inside their parent route's editor.
    const target =
      location.location_type === 'sector'
        ? boundaries.find((b) => b.sectors?.some((s) => s.id === location.id))
        : undefined;
    setEditorMode('edit');
    setEditorKind('location');
    setEditLocation(target ?? toLocationEditTarget(location));
    setEditDevice(null);
    setEditorOpen(true);
  };

  const handleEditDevice = (device: Device) => {
    setEditorMode('edit');
    setEditorKind('device');
    setEditDevice(device);
    setEditLocation(null);
    setEditorOpen(true);
  };

  const handleSavedLocation = async (saved: Location, created: boolean) => {
    toast.success(`Location ${created ? 'created' : 'updated'} successfully`);
    await onReload();
    locationHighlight.highlight(saved.id);
  };

  const handleSavedDevice = async (saved: Device, created: boolean) => {
    toast.success(`Device ${created ? 'created' : 'updated'} successfully`);
    await onReload();
    deviceHighlight.highlight(saved.id);
  };

  const handleConfirmDeleteLocation = async () => {
    if (!deleteLocationTarget) return;
    setDeletingLocation(true);
    try {
      await locationsAPI.delete(deleteLocationTarget.id);
      setDeleteLocationTarget(null);
      await onReload();
      toast.success('Location deleted');
    } catch (err) {
      setCrudError(err instanceof Error ? err.message : 'Failed to delete location');
    } finally {
      setDeletingLocation(false);
    }
  };

  const handleConfirmDeactivateDevice = async () => {
    if (!deactivateDeviceTarget) return;
    setDeactivatingDevice(true);
    try {
      await devicesAPI.deactivate(deactivateDeviceTarget.id);
      setDeactivateDeviceTarget(null);
      await onReload();
      toast.success('Device deactivated');
    } catch (err) {
      setCrudError(err instanceof Error ? err.message : 'Failed to deactivate device');
    } finally {
      setDeactivatingDevice(false);
    }
  };

  const handleReactivateDevice = async (device: Device) => {
    try {
      await devicesAPI.reactivate(device.id);
      await onReload();
      toast.success('Device reactivated');
      deviceHighlight.highlight(device.id);
    } catch (err) {
      setCrudError(err instanceof Error ? err.message : 'Failed to reactivate device');
    }
  };

  // The search + kind filter drive the map and the list together.
  const { rows, filteredDevices, filteredBoundaries, locationCount, deviceCount } = useMemo(() => {
    const query = search.trim().toLowerCase();
    const showLocations = kindFilter !== 'device';
    const showDevices = kindFilter !== 'location';

    // Sectors are managed inside their parent route's editor, so they fold
    // into the route's row here; searching a sector name finds the route.
    const topLevel = locations.filter((l) => l.location_type !== 'sector');
    const matchesLocation = (l: Location) => {
      if (
        surveyTypeFilter !== '' &&
        !(usedByLocation.get(l.id) ?? []).some((st) => st.id === surveyTypeFilter)
      ) {
        return false;
      }
      if (!query) return true;
      if (locationDisplayName(l).toLowerCase().includes(query)) return true;
      const sectors = boundariesById.get(l.id)?.sectors ?? [];
      return sectors.some((s) => s.name.toLowerCase().includes(query));
    };
    const matchesDevice = (d: Device) => {
      if (
        surveyTypeFilter !== '' &&
        !(d.survey_types ?? []).some((st) => st.id === surveyTypeFilter)
      ) {
        return false;
      }
      return !query || d.name.toLowerCase().includes(query);
    };

    const fLocations = showLocations ? topLevel.filter(matchesLocation) : [];
    const fDevices = showDevices ? devices.filter(matchesDevice) : [];
    const fBoundaries = showLocations ? boundaries.filter(matchesLocation) : [];

    const out: Row[] = [];
    for (const location of fLocations) {
      out.push({ kind: 'location', sortName: locationDisplayName(location).toLowerCase(), location });
    }
    for (const device of fDevices) {
      out.push({ kind: 'device', sortName: device.name.toLowerCase(), device });
    }
    // Numeric-aware compare so station names read N1, N2 … N10, not N1, N10, N2.
    out.sort((a, b) =>
      a.sortName.localeCompare(b.sortName, undefined, { numeric: true, sensitivity: 'base' }),
    );

    return {
      rows: out,
      filteredDevices: fDevices,
      filteredBoundaries: fBoundaries,
      locationCount: topLevel.length,
      deviceCount: devices.length,
    };
  }, [locations, devices, boundaries, boundariesById, usedByLocation, search, kindFilter, surveyTypeFilter]);

  const error = loadError ?? crudError;
  const colSpan = 4;

  // Rendering helpers shared between the desktop table and mobile card list.
  // Rows open the editor on click, so the icons stop propagation; edit and
  // delete stay quiet until pointed at rather than filling the page with red.
  const actionIconSx = (hoverColor: string) => ({
    color: 'text.disabled',
    '&:hover': { color: hoverColor },
  });

  const locationActions = (location: Location) => (
    <>
      <IconButton
        size="small"
        onClick={(e) => {
          e.stopPropagation();
          handleEditLocation(location);
        }}
        sx={actionIconSx('primary.main')}
        title="Edit"
      >
        <Edit />
      </IconButton>
      <IconButton
        size="small"
        onClick={(e) => {
          e.stopPropagation();
          setDeleteLocationTarget(location);
        }}
        sx={actionIconSx('error.main')}
        title="Delete"
      >
        <Delete />
      </IconButton>
    </>
  );

  const deviceActions = (device: Device) => (
    <>
      <IconButton
        size="small"
        onClick={(e) => {
          e.stopPropagation();
          handleEditDevice(device);
        }}
        sx={actionIconSx('primary.main')}
        title="Edit"
      >
        <Edit />
      </IconButton>
      {device.is_active ? (
        <IconButton
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            setDeactivateDeviceTarget(device);
          }}
          sx={actionIconSx('error.main')}
          title="Deactivate"
        >
          <Delete />
        </IconButton>
      ) : (
        <IconButton
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            handleReactivateDevice(device);
          }}
          sx={{ color: 'success.main' }}
          title="Reactivate"
        >
          <RestoreFromTrash />
        </IconButton>
      )}
    </>
  );

  /** Type cell: a coloured chip for mappable types, quiet text for the rest. */
  const locationTypeCell = (location: Location) => {
    const type = location.location_type ?? 'none';
    if (type === 'none') {
      return (
        <Typography variant="body2" color="text.secondary">
          No coordinates
        </Typography>
      );
    }
    const sectorCount =
      type === 'route' ? (boundariesById.get(location.id)?.sectors?.length ?? 0) : 0;
    return (
      <Stack direction="row" alignItems="center" spacing={1}>
        <Chip
          label={LOCATION_TYPE_LABELS[type]}
          size="small"
          color={LOCATION_TYPE_COLORS[type]}
          sx={{ minWidth: 70 }}
        />
        {sectorCount > 0 && (
          <Typography variant="caption" color="text.secondary">
            {sectorCount} sector{sectorCount === 1 ? '' : 's'}
          </Typography>
        )}
      </Stack>
    );
  };

  const deviceTypeCell = (device: Device) => (
    <Stack direction="row" alignItems="center" spacing={1}>
      <Chip
        label={DEVICE_TYPE_LABELS[device.device_type]}
        size="small"
        color={DEVICE_CHIP_COLORS[device.device_type]}
        variant="outlined"
      />
      {!device.is_active && <Chip label="Inactive" size="small" />}
    </Stack>
  );

  /** "Used by" cell: one small chip per linked survey type, or a quiet dash. */
  const usedByCell = (refs: SurveyTypeRef[] | undefined) =>
    !refs || refs.length === 0 ? (
      <Typography variant="body2" color="text.secondary">
        —
      </Typography>
    ) : (
      <Stack direction="row" flexWrap="wrap" gap={0.5}>
        {refs.map((st) => (
          <Chip key={st.id} label={st.name} size="small" variant="outlined" />
        ))}
      </Stack>
    );

  const filtering = search.trim() !== '' || kindFilter !== 'all' || surveyTypeFilter !== '';
  const emptyMessage = filtering ? 'No matches' : 'No locations or devices yet';

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setCrudError(null)}>
          {error}
        </Alert>
      )}

      {/* Filter toolbar — drives both the map and the list below */}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ xs: 'stretch', sm: 'center' }}
        justifyContent="space-between"
        gap={1.5}
        sx={{ mb: 2 }}
      >
        <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }} gap={1.5}>
          <TextField
            size="small"
            placeholder="Search by name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <Search fontSize="small" />
                  </InputAdornment>
                ),
              },
            }}
            sx={{ minWidth: { sm: 260 } }}
          />
          <ToggleButtonGroup
            value={kindFilter}
            exclusive
            onChange={(_, next: 'all' | EntityKind | null) => next && setKindFilter(next)}
            size="small"
            aria-label="filter by kind"
          >
            <ToggleButton value="all">All</ToggleButton>
            <ToggleButton value="location">Locations</ToggleButton>
            <ToggleButton value="device">Devices</ToggleButton>
          </ToggleButtonGroup>
          {surveyTypeOptions.length > 0 && (
            <FormControl size="small" sx={{ minWidth: 170 }}>
              <InputLabel>Used by</InputLabel>
              <Select
                value={surveyTypeFilter}
                label="Used by"
                onChange={(e) => setSurveyTypeFilter(e.target.value as number | '')}
              >
                <MenuItem value="">Any survey type</MenuItem>
                {surveyTypeOptions.map((st) => (
                  <MenuItem key={st.id} value={st.id}>
                    {st.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
        </Stack>

        <Stack direction="row" alignItems="center" justifyContent="flex-end" gap={1.5}>
          <ViewModeToggle value={viewMode} onChange={setViewMode} />
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={handleAdd}
            sx={{ bgcolor: brandColors.main, '&:hover': { bgcolor: brandColors.hover } }}
          >
            Add
          </Button>
        </Stack>
      </Stack>

      {!loading && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          {filtering
            ? `${rows.length} match${rows.length === 1 ? '' : 'es'}`
            : `${locationCount} location${locationCount === 1 ? '' : 's'} · ${deviceCount} device${
                deviceCount === 1 ? '' : 's'
              }`}
        </Typography>
      )}

      {viewMode === 'map' ? (
        <DeviceMap
          devices={filteredDevices}
          locationsWithBoundaries={filteredBoundaries}
          loading={loading}
          height="calc(100vh - 330px)"
          onEditDevice={handleEditDevice}
          onDeactivateDevice={(device) => setDeactivateDeviceTarget(device)}
          onReactivateDevice={handleReactivateDevice}
          onEditLocation={handleEditLocation}
          onDeleteLocation={(loc) => setDeleteLocationTarget(loc)}
        />
      ) : isMobile ? (
        loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        ) : rows.length === 0 ? (
          <Paper variant="outlined" sx={{ py: 6, px: 2, textAlign: 'center', color: 'text.secondary' }}>
            {emptyMessage}
          </Paper>
        ) : (
          <Stack spacing={1.5}>
            {rows.map((row) =>
              row.kind === 'location' ? (
                <EntityCard
                  key={`location-${row.location.id}`}
                  ref={locationHighlight.rowRef(row.location.id) as Ref<HTMLDivElement>}
                  sx={locationHighlight.rowSx(row.location.id)}
                  onClick={() => handleEditLocation(row.location)}
                  title={
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <PlaceIcon fontSize="small" sx={{ color: 'text.disabled' }} titleAccess="Location" />
                      <Typography variant="body1" sx={{ fontWeight: 500 }}>
                        {locationDisplayName(row.location)}
                      </Typography>
                    </Stack>
                  }
                  chips={
                    <>
                      {locationTypeCell(row.location)}
                      {(usedByLocation.get(row.location.id) ?? []).map((st) => (
                        <Chip key={st.id} label={st.name} size="small" variant="outlined" />
                      ))}
                    </>
                  }
                  actions={locationActions(row.location)}
                />
              ) : (
                <EntityCard
                  key={`device-${row.device.id}`}
                  ref={deviceHighlight.rowRef(row.device.id) as Ref<HTMLDivElement>}
                  sx={deviceHighlight.rowSx(row.device.id)}
                  onClick={() => handleEditDevice(row.device)}
                  title={
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <SensorsIcon fontSize="small" sx={{ color: 'text.disabled' }} titleAccess="Device" />
                      <Typography variant="body1" sx={{ fontWeight: 500 }}>
                        {row.device.name}
                      </Typography>
                    </Stack>
                  }
                  chips={
                    <>
                      {deviceTypeCell(row.device)}
                      {(row.device.survey_types ?? []).map((st) => (
                        <Chip key={st.id} label={st.name} size="small" variant="outlined" />
                      ))}
                    </>
                  }
                  actions={deviceActions(row.device)}
                />
              ),
            )}
          </Stack>
        )
      ) : (
        <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
          <Table sx={{ minWidth: 640 }}>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Used by</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={colSpan} align="center" sx={{ py: 8 }}>
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={colSpan} align="center" sx={{ py: 8, color: 'text.secondary' }}>
                    {emptyMessage}
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) =>
                  row.kind === 'location' ? (
                    <TableRow
                      key={`location-${row.location.id}`}
                      ref={locationHighlight.rowRef(row.location.id)}
                      onClick={() => handleEditLocation(row.location)}
                      sx={[
                        { cursor: 'pointer', '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.02)' } },
                        locationHighlight.rowSx(row.location.id),
                      ]}
                    >
                      <TableCell>
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <PlaceIcon fontSize="small" sx={{ color: 'text.disabled' }} titleAccess="Location" />
                          <Typography variant="body1">{locationDisplayName(row.location)}</Typography>
                        </Stack>
                      </TableCell>
                      <TableCell>{locationTypeCell(row.location)}</TableCell>
                      <TableCell>{usedByCell(usedByLocation.get(row.location.id))}</TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                          {locationActions(row.location)}
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ) : (
                    <TableRow
                      key={`device-${row.device.id}`}
                      ref={deviceHighlight.rowRef(row.device.id)}
                      onClick={() => handleEditDevice(row.device)}
                      sx={[
                        { cursor: 'pointer', '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.02)' } },
                        deviceHighlight.rowSx(row.device.id),
                      ]}
                    >
                      <TableCell>
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <SensorsIcon fontSize="small" sx={{ color: 'text.disabled' }} titleAccess="Device" />
                          <Typography variant="body1">{row.device.name}</Typography>
                        </Stack>
                      </TableCell>
                      <TableCell>{deviceTypeCell(row.device)}</TableCell>
                      <TableCell>{usedByCell(row.device.survey_types)}</TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                          {deviceActions(row.device)}
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ),
                )
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <LocationDeviceEditorDialog
        open={editorOpen}
        mode={editorMode}
        editKind={editorKind}
        location={editLocation}
        device={editDevice}
        referenceLocations={boundaries}
        onClose={() => setEditorOpen(false)}
        onSavedLocation={handleSavedLocation}
        onSavedDevice={handleSavedDevice}
      />

      <Dialog open={deleteLocationTarget !== null} onClose={() => setDeleteLocationTarget(null)}>
        <DialogTitle>Delete location?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Delete &ldquo;{deleteLocationTarget?.name}&rdquo;? This cannot be undone. Surveys and sightings
            linked to this location will keep their records but lose the association.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteLocationTarget(null)} disabled={deletingLocation}>
            Cancel
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={handleConfirmDeleteLocation}
            disabled={deletingLocation}
          >
            {deletingLocation ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deactivateDeviceTarget !== null} onClose={() => setDeactivateDeviceTarget(null)}>
        <DialogTitle>Deactivate device?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Deactivate <strong>{deactivateDeviceTarget?.name}</strong>? It will no longer appear in
            active lists, but historical data is preserved.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeactivateDeviceTarget(null)} disabled={deactivatingDevice}>
            Cancel
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={handleConfirmDeactivateDevice}
            disabled={deactivatingDevice}
          >
            {deactivatingDevice ? 'Deactivating…' : 'Deactivate'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
