/**
 * Builds a route or area from typed coordinates: one at a time in labelled
 * fields, or a whole list at once via the paste box.
 *
 * Single entry echoes each coordinate back in both formats before it is
 * added, so a typo is caught while it is still cheap to fix. The paste box
 * accepts a document as written — waypoints mixed with prose — extracts every
 * coordinate it can find and reports every token it could not resolve, then
 * lists the result in walking order where it can still be checked, reordered
 * or removed before the shape is saved.
 */

import { useMemo, useState } from 'react';
import { Box, Button, Collapse, IconButton, Stack, TextField, Tooltip, Typography } from '@mui/material';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd';

import CoordinateEntry, { type CoordinateFormat } from '../surveys/CoordinateEntry';
import { extractCoordinateList, latLngToGridRef, type ExtractedCoordinate } from '../../utils/coords';
import type { Position } from '../../utils/geometry';

interface CoordinatePointsEditorProps {
  /** Ordered [lng, lat] positions, matching GeoJSON. */
  points: Position[];
  onChange: (next: Position[]) => void;
  format: CoordinateFormat;
  onFormatChange: (next: CoordinateFormat) => void;
  /** 'area' closes the ring; 'route' is an open line. Affects wording only. */
  shape: 'route' | 'area';
  /** Seeds the grid square for the first point. */
  nearLat?: number;
  nearLng?: number;
  disabled?: boolean;
}

export default function CoordinatePointsEditor({
  points,
  onChange,
  format,
  onFormatChange,
  shape,
  nearLat,
  nearLng,
  disabled = false,
}: CoordinatePointsEditorProps) {
  const minimum = shape === 'area' ? 3 : 2;

  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');

  const pasted = useMemo(() => {
    const all = pasteText.trim() ? extractCoordinateList(pasteText) : [];
    return {
      found: all.filter((c): c is Extract<ExtractedCoordinate, { ok: true }> => c.ok),
      problems: all.filter((c): c is Extract<ExtractedCoordinate, { ok: false }> => !c.ok),
    };
  }, [pasteText]);

  const addPoint = (lat: number, lng: number) => onChange([...points, [lng, lat]]);

  const addPastedPoints = () => {
    if (pasted.found.length === 0) return;
    onChange([...points, ...pasted.found.map((c): Position => [c.lng, c.lat])]);
    setPasteText('');
    setPasteOpen(false);
  };

  const removePoint = (index: number) =>
    onChange(points.filter((_, i) => i !== index));

  const movePoint = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= points.length) return;
    const next = [...points];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  // Later points seed their square from the previous one, so a route that
  // crosses a 100 km boundary still starts from the right place.
  const [lastLng, lastLat] = points[points.length - 1] ?? [];
  const seedLat = points.length > 0 ? lastLat : nearLat;
  const seedLng = points.length > 0 ? lastLng : nearLng;

  return (
    <Box>
      <Typography variant="subtitle2" gutterBottom>
        Points ({points.length})
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ mb: 1.5, display: 'block' }}>
        {shape === 'area'
          ? 'Corners of the area, in order. At least 3; the shape closes itself.'
          : 'Stops along the route, in the order they are walked. At least 2.'}{' '}
        The shape stays editable on the map afterwards.
      </Typography>

      <CoordinateEntry
        format={format}
        onFormatChange={onFormatChange}
        onAdd={addPoint}
        nearLat={seedLat}
        nearLng={seedLng}
        addLabel={points.length === 0 ? 'Add first point' : 'Add point'}
        disabled={disabled}
      />

      <Box sx={{ mt: 1 }}>
        <Button
          size="small"
          startIcon={<PlaylistAddIcon />}
          onClick={() => setPasteOpen((o) => !o)}
          disabled={disabled}
          sx={{ textTransform: 'none' }}
        >
          {pasteOpen ? 'Hide paste box' : 'Paste a list of coordinates'}
        </Button>
        <Collapse in={pasteOpen}>
          <Stack spacing={1} sx={{ mt: 1 }}>
            <TextField
              size="small"
              fullWidth
              multiline
              minRows={4}
              maxRows={10}
              placeholder={
                'Paste grid references or lat/long pairs, one stop per line — surrounding text is fine, e.g.\n1: ST734400 – Start from the office\n2. ST734399 – Continue along the mown path'
              }
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              disabled={disabled}
              inputProps={{ 'aria-label': 'Paste a list of coordinates' }}
            />
            {pasted.problems.length > 0 && (
              <Typography variant="caption" color="error">
                Could not read{' '}
                {pasted.problems.map((p) => `“${p.source}”`).join(', ')} — check for missing or
                extra figures.
              </Typography>
            )}
            <Stack direction="row" alignItems="center" spacing={1}>
              <Button
                variant="contained"
                size="small"
                onClick={addPastedPoints}
                disabled={disabled || pasted.found.length === 0}
                sx={{ textTransform: 'none', fontWeight: 600 }}
              >
                Add {pasted.found.length > 0 ? pasted.found.length : ''} point
                {pasted.found.length === 1 ? '' : 's'}
              </Button>
              <Typography variant="caption" color={pasted.found.length > 0 ? 'text.secondary' : 'text.disabled'}>
                {pasteText.trim() === ''
                  ? 'Coordinates are found automatically — the rest of the text is ignored.'
                  : pasted.found.length === 0
                    ? 'No coordinates found yet.'
                    : `${pasted.found.length} coordinate${pasted.found.length === 1 ? '' : 's'} found, in the order written.`}
              </Typography>
            </Stack>
          </Stack>
        </Collapse>
      </Box>

      {points.length > 0 && (
        <Stack spacing={0.5} sx={{ mt: 1.5 }}>
          {points.map(([lng, lat], index) => {
            const gridRef = latLngToGridRef(lat, lng)?.ref;
            return (
              <Stack
                key={`${lng},${lat},${index}`}
                direction="row"
                alignItems="center"
                spacing={1}
                sx={{
                  px: 1,
                  py: 0.5,
                  borderRadius: 1,
                  bgcolor: 'action.hover',
                }}
              >
                <Typography variant="body2" sx={{ fontWeight: 700, minWidth: 24 }}>
                  {index + 1}
                </Typography>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  {/* Both formats always shown: the grid ref is what the survey
                      document quotes, the degrees are what gets stored. */}
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {gridRef ?? 'Outside the OS grid'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {lat.toFixed(5)}, {lng.toFixed(5)}
                  </Typography>
                </Box>
                <Tooltip title="Move up">
                  <span>
                    <IconButton
                      size="small"
                      onClick={() => movePoint(index, -1)}
                      disabled={disabled || index === 0}
                      aria-label={`Move point ${index + 1} up`}
                    >
                      <ArrowUpwardIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title="Move down">
                  <span>
                    <IconButton
                      size="small"
                      onClick={() => movePoint(index, 1)}
                      disabled={disabled || index === points.length - 1}
                      aria-label={`Move point ${index + 1} down`}
                    >
                      <ArrowDownwardIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title="Remove">
                  <span>
                    <IconButton
                      size="small"
                      onClick={() => removePoint(index)}
                      disabled={disabled}
                      aria-label={`Remove point ${index + 1}`}
                    >
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              </Stack>
            );
          })}
        </Stack>
      )}

      {points.length > 0 && points.length < minimum && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          {minimum - points.length} more point{minimum - points.length === 1 ? '' : 's'} needed to
          make {shape === 'area' ? 'an area' : 'a route'}.
        </Typography>
      )}
    </Box>
  );
}
