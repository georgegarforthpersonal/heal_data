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

import { useMemo, useState } from 'react';
import { Box, Button, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';

import { latLngToGridRef, parseLatLng, resolveGridRefParts } from '../../utils/coords';

export type CoordinateFormat = 'gridref' | 'latlng';

interface CoordinateEntryProps {
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

/** Six figures = 100 m, the precision of a typical survey reference. */
const FIGURES_PER_AXIS = 3;

export default function CoordinateEntry({
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

  const [square, setSquare] = useState(defaultSquare);
  const [easting, setEasting] = useState('');
  const [northing, setNorthing] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [error, setError] = useState<string | null>(null);

  const resolved = useMemo(() => {
    if (format === 'gridref') {
      if (!square.trim() || !easting.trim() || !northing.trim()) return null;
      const result = resolveGridRefParts(square, easting, northing);
      return result.ok ? result : null;
    }
    if (!lat.trim() || !lng.trim()) return null;
    const result = parseLatLng(`${lat.trim()}, ${lng.trim()}`);
    return result.ok ? result : null;
  }, [format, square, easting, northing, lat, lng]);

  const clear = () => {
    setEasting('');
    setNorthing('');
    setLat('');
    setLng('');
    setError(null);
  };

  const handleAdd = () => {
    if (format === 'gridref') {
      const result = resolveGridRefParts(square, easting, northing);
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
    // Keep the square: consecutive points on one site nearly always share it.
    clear();
  };

  // Digits only, so a stray letter never reaches the parser.
  const digitsOnly = (setter: (v: string) => void) => (raw: string) => {
    if (raw === '' || /^\d{1,5}$/.test(raw)) {
      setter(raw);
      setError(null);
    }
  };

  const numericProps = {
    inputMode: 'numeric' as const,
    pattern: '[0-9]*',
    enterKeyHint: 'done' as const,
  };

  const onEnter = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  };

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
        <Stack direction="row" spacing={1} alignItems="flex-start">
          <TextField
            size="small"
            InputLabelProps={{ shrink: true }}
            label="Square"
            placeholder="ST"
            value={square}
            onChange={(e) => {
              const raw = e.target.value.toUpperCase();
              if (raw === '' || /^[A-Z]{1,2}$/.test(raw)) {
                setSquare(raw);
                setError(null);
              }
            }}
            onKeyDown={onEnter}
            disabled={disabled}
            inputProps={{ 'aria-label': 'Grid square', style: { textTransform: 'uppercase' } }}
            sx={{ width: 90 }}
          />
          <TextField
            size="small"
            InputLabelProps={{ shrink: true }}
            label="Easting"
            placeholder="734"
            value={easting}
            onChange={(e) => digitsOnly(setEasting)(e.target.value)}
            onKeyDown={onEnter}
            disabled={disabled}
            inputProps={{ ...numericProps, 'aria-label': 'Easting' }}
            sx={{ flex: 1, minWidth: 0 }}
          />
          <TextField
            size="small"
            InputLabelProps={{ shrink: true }}
            label="Northing"
            placeholder="400"
            value={northing}
            onChange={(e) => digitsOnly(setNorthing)(e.target.value)}
            onKeyDown={onEnter}
            disabled={disabled}
            inputProps={{ ...numericProps, 'aria-label': 'Northing' }}
            sx={{ flex: 1, minWidth: 0 }}
          />
        </Stack>
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
              ? `${FIGURES_PER_AXIS} figures each for a 100 m square`
              : 'Decimal degrees (WGS84)'}
          </Typography>
        )}
      </Stack>
    </Box>
  );
}
