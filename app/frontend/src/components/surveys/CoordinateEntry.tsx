/**
 * Structured entry for a single coordinate, in either OS grid reference or
 * WGS84 decimal degrees.
 *
 * Deliberately not a free-text box. A typo in a pasted string silently becomes
 * a point in the wrong field, so each part gets its own labelled input with its
 * own validation, and the resolved position is echoed back before it is added.
 *
 * The format toggle is controlled by the parent so a list of points keeps one
 * format throughout, and so the choice survives adding a point.
 */

import { useImperativeHandle, useMemo, useState, type Ref } from 'react';
import { Box, Button, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';

import { latLngToGridRef, parseGridRef, parseLatLng } from '../../utils/coords';

export type CoordinateFormat = 'gridref' | 'latlng';

/** Result of flushing the entry box from outside (e.g. on dialog save). */
export type CommitPendingResult =
  | { status: 'empty' } // nothing typed beyond the seeded square
  | { status: 'invalid' } // something typed that does not resolve; error shown
  | { status: 'committed'; lat: number; lng: number }; // added via onAdd

export interface CoordinateEntryHandle {
  /**
   * Add whatever is typed but not yet added, as if the add button had been
   * pressed — so a coordinate typed just before "Save" is not silently lost.
   */
  commitPending(): CommitPendingResult;
}

interface CoordinateEntryProps {
  ref?: Ref<CoordinateEntryHandle>;
  format: CoordinateFormat;
  onFormatChange: (next: CoordinateFormat) => void;
  /** Called with WGS84 degrees once the entry resolves. */
  onAdd: (lat: number, lng: number) => void;
  /**
   * Seeds the grid square so only the figures need typing. Usually the map
   * centre or an existing point on the same site.
   */
  nearLat?: number;
  nearLng?: number;
  addLabel?: string;
  disabled?: boolean;
}

export default function CoordinateEntry({
  ref,
  format,
  onFormatChange,
  onAdd,
  nearLat,
  nearLng,
  addLabel = 'Add point',
  disabled = false,
}: CoordinateEntryProps) {
  const defaultSquare = useMemo(() => {
    if (typeof nearLat !== 'number' || typeof nearLng !== 'number') return '';
    return latLngToGridRef(nearLat, nearLng)?.square ?? '';
  }, [nearLat, nearLng]);

  // Seeded with the local 100 km square so only the figures need typing.
  const [gridRef, setGridRef] = useState(defaultSquare);
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [error, setError] = useState<string | null>(null);

  const resolved = useMemo(() => {
    if (format === 'gridref') {
      const result = parseGridRef(gridRef);
      return result.ok ? result : null;
    }
    if (!lat.trim() || !lng.trim()) return null;
    const result = parseLatLng(`${lat.trim()}, ${lng.trim()}`);
    return result.ok ? result : null;
  }, [format, gridRef, lat, lng]);

  const clear = () => {
    // Keep the square, drop the figures: consecutive points share a square.
    setGridRef(gridRef.trim().slice(0, 2));
    setLat('');
    setLng('');
    setError(null);
  };

  const handleAdd = () => {
    if (format === 'gridref') {
      const result = parseGridRef(gridRef);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onAdd(result.lat, result.lng);
    } else {
      if (!lat.trim() || !lng.trim()) {
        setError('Enter both a latitude and a longitude');
        return;
      }
      const result = parseLatLng(`${lat.trim()}, ${lng.trim()}`);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onAdd(result.lat, result.lng);
    }
    clear();
  };

  const onEnter = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  };

  useImperativeHandle(ref, (): CoordinateEntryHandle => ({
    commitPending() {
      if (format === 'gridref') {
        const trimmed = gridRef.trim();
        // Nothing, or just the seeded square letters, means nothing was typed.
        if (trimmed === '' || /^[A-Z]{1,2}$/.test(trimmed)) return { status: 'empty' };
        const result = parseGridRef(trimmed);
        if (!result.ok) {
          setError(result.error);
          return { status: 'invalid' };
        }
        onAdd(result.lat, result.lng);
        clear();
        return { status: 'committed', lat: result.lat, lng: result.lng };
      }
      if (!lat.trim() && !lng.trim()) return { status: 'empty' };
      if (!lat.trim() || !lng.trim()) {
        setError('Enter both a latitude and a longitude');
        return { status: 'invalid' };
      }
      const result = parseLatLng(`${lat.trim()}, ${lng.trim()}`);
      if (!result.ok) {
        setError(result.error);
        return { status: 'invalid' };
      }
      onAdd(result.lat, result.lng);
      clear();
      return { status: 'committed', lat: result.lat, lng: result.lng };
    },
  }));

  return (
    <Box>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ mb: 1, gap: 1, flexWrap: 'wrap' }}
      >
        <Typography variant="caption" color="text.secondary">
          Coordinate format
        </Typography>
        <ToggleButtonGroup
          value={format}
          exclusive
          size="small"
          onChange={(_, next: CoordinateFormat | null) => {
            if (!next) return;
            onFormatChange(next);
            setError(null);
          }}
          disabled={disabled}
        >
          <ToggleButton value="gridref" sx={{ textTransform: 'none' }}>
            Grid reference
          </ToggleButton>
          <ToggleButton value="latlng" sx={{ textTransform: 'none' }}>
            Lat / Long
          </ToggleButton>
        </ToggleButtonGroup>
      </Stack>

      {format === 'gridref' ? (
        <TextField
          size="small"
          fullWidth
          InputLabelProps={{ shrink: true }}
          label="Grid reference"
          placeholder="ST734400"
          value={gridRef}
          onChange={(e) => {
            // Letters, digits and spaces only, so prose can never get in.
            const raw = e.target.value.toUpperCase();
            if (raw === '' || /^[A-Z][A-Z]?[\d ]*$/.test(raw)) {
              setGridRef(raw);
              setError(null);
            }
          }}
          onKeyDown={onEnter}
          disabled={disabled}
          inputProps={{
            'aria-label': 'Grid reference',
            style: { textTransform: 'uppercase' },
            enterKeyHint: 'done',
          }}
        />
      ) : (
        <Stack direction="row" spacing={1} alignItems="flex-start">
          <TextField
            size="small"
            InputLabelProps={{ shrink: true }}
            label="Latitude"
            placeholder="51.15908"
            value={lat}
            onChange={(e) => {
              setLat(e.target.value);
              setError(null);
            }}
            onKeyDown={onEnter}
            disabled={disabled}
            inputProps={{ inputMode: 'decimal', 'aria-label': 'Latitude' }}
            sx={{ flex: 1, minWidth: 0 }}
          />
          <TextField
            size="small"
            InputLabelProps={{ shrink: true }}
            label="Longitude"
            placeholder="-2.38104"
            value={lng}
            onChange={(e) => {
              setLng(e.target.value);
              setError(null);
            }}
            onKeyDown={onEnter}
            disabled={disabled}
            inputProps={{ inputMode: 'decimal', 'aria-label': 'Longitude' }}
            sx={{ flex: 1, minWidth: 0 }}
          />
        </Stack>
      )}

      <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 1, flexWrap: 'wrap' }}>
        <Button
          variant="contained"
          size="small"
          onClick={handleAdd}
          disabled={disabled}
          sx={{ textTransform: 'none', fontWeight: 600 }}
        >
          {addLabel}
        </Button>
        {/* Echo the resolved position before it is committed: the check that
            catches a transposed digit while it is still cheap to fix. */}
        {error ? (
          <Typography variant="caption" color="error">
            {error}
          </Typography>
        ) : resolved ? (
          <Typography variant="caption" color="text.secondary">
            {format === 'gridref'
              ? `${resolved.lat.toFixed(5)}, ${resolved.lng.toFixed(5)}`
              : (latLngToGridRef(resolved.lat, resolved.lng)?.ref ?? 'Outside the OS grid')}
          </Typography>
        ) : (
          <Typography variant="caption" color="text.disabled">
            {format === 'gridref'
              ? 'e.g. ST734400 — as written on the survey sheet'
              : 'Decimal degrees (WGS84)'}
          </Typography>
        )}
      </Stack>
    </Box>
  );
}
