import { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  TextField,
  Autocomplete,
  IconButton,
  Button,
  Stack,
  Chip,
  Paper,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import MaleIcon from '@mui/icons-material/Male';
import FemaleIcon from '@mui/icons-material/Female';
import FlightIcon from '@mui/icons-material/Flight';
import NatureIcon from '@mui/icons-material/Nature';
import MusicNoteIcon from '@mui/icons-material/MusicNote';

import type { Species, BirdSex, BirdPosture } from '../../services/api';
import type { MapMarker } from './mapModeUtils';
import type { DraftIndividualLocation, IndividualBirdFields } from './MultiLocationMapPicker';
import { getSpeciesIcon } from '../../config';
import { BirdObservationFields } from './BirdObservationFields';

interface MarkerPopupContentAddProps {
  mode: 'add';
  species: Species[];
  showBirdFields?: boolean;
  onAdd: (speciesId: number, count: number, birdFieldsList?: IndividualBirdFields[]) => void;
  onDiscard: () => void;
  marker?: undefined;
  onUpdate?: undefined;
  onDelete?: undefined;
}

interface MarkerPopupContentEditProps {
  mode: 'edit';
  species: Species[];
  showBirdFields?: boolean;
  marker: MapMarker;
  onUpdate: (updates: Partial<Pick<DraftIndividualLocation, 'count' | 'sex' | 'posture' | 'singing' | 'birdFieldsList'>>) => void;
  onDelete: () => void;
  onAdd?: undefined;
}

interface MarkerPopupContentViewProps {
  mode: 'view';
  species: Species[];
  showBirdFields?: boolean;
  marker: MapMarker;
  onAdd?: undefined;
  onDiscard?: undefined;
  onUpdate?: undefined;
  onDelete?: undefined;
}

type MarkerPopupContentProps = MarkerPopupContentAddProps | MarkerPopupContentEditProps | MarkerPopupContentViewProps;

function stopPropagation(e: React.SyntheticEvent) {
  e.stopPropagation();
}

export function MarkerPopupContent(props: MarkerPopupContentProps) {
  const { mode, species } = props;

  // Sort species by type then name
  const sortedSpecies = useMemo(() => {
    return [...species].sort((a, b) => {
      if (a.type !== b.type) return a.type.localeCompare(b.type);
      const nameA = a.name || a.scientific_name || '';
      const nameB = b.name || b.scientific_name || '';
      return nameA.localeCompare(nameB);
    });
  }, [species]);

  const formatCategoryName = (category: string): string => {
    return category.charAt(0).toUpperCase() + category.slice(1);
  };

  if (mode === 'add') {
    return (
      <AddPopupForm
        species={species}
        sortedSpecies={sortedSpecies}
        onAdd={props.onAdd}
        onDiscard={props.onDiscard}
        formatCategoryName={formatCategoryName}
      />
    );
  }

  if (mode === 'view') {
    return (
      <ViewPopupContent
        species={species}
        marker={props.marker}
      />
    );
  }

  return (
    <EditPopupForm
      species={species}
      marker={props.marker}
      onUpdate={props.onUpdate}
      onDelete={props.onDelete}
    />
  );
}

// Add form for pending markers
function AddPopupForm({
  species: _species,
  sortedSpecies,
  onAdd,
  onDiscard,
  formatCategoryName,
}: {
  species: Species[];
  sortedSpecies: Species[];
  onAdd: (speciesId: number, count: number, birdFieldsList?: IndividualBirdFields[]) => void;
  onDiscard: () => void;
  formatCategoryName: (category: string) => string;
}) {
  const [selectedSpecies, setSelectedSpecies] = useState<Species | null>(null);
  const [count, setCount] = useState(1);
  const [birdFieldsList, setBirdFieldsList] = useState<IndividualBirdFields[]>([{ sex: null, posture: null, singing: null }]);
  const [birdDetailsExpanded, setBirdDetailsExpanded] = useState(false);

  const isBird = selectedSpecies?.type === 'bird';

  // Sync birdFieldsList length with count
  const handleCountChange = (newCount: number) => {
    setCount(newCount);
    if (newCount > birdFieldsList.length) {
      setBirdFieldsList([
        ...birdFieldsList,
        ...Array.from({ length: newCount - birdFieldsList.length }, () => ({
          sex: null as BirdSex | null,
          posture: null as BirdPosture | null,
          singing: null as boolean | null,
        })),
      ]);
    } else if (newCount < birdFieldsList.length && newCount > 0) {
      setBirdFieldsList(birdFieldsList.slice(0, newCount));
    }
  };

  const handleBirdFieldChange = (index: number, fields: Partial<IndividualBirdFields>) => {
    setBirdFieldsList((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], ...fields };
      return updated;
    });
  };

  const handleAdd = () => {
    if (!selectedSpecies) return;
    onAdd(selectedSpecies.id, count, isBird ? birdFieldsList.slice(0, count) : undefined);
    // Reset form
    setSelectedSpecies(null);
    setCount(1);
    setBirdFieldsList([{ sex: null, posture: null, singing: null }]);
  };

  return (
    <Box
      onMouseDown={stopPropagation}
      onClick={stopPropagation}
      onDoubleClick={stopPropagation}
      onWheel={stopPropagation}
      sx={{ minWidth: 240, p: 0.5 }}
    >
      <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1.5 }}>
        Add Sighting
      </Typography>

      <Stack spacing={1.5}>
        <Autocomplete
          options={sortedSpecies}
          groupBy={(option) => formatCategoryName(option.type)}
          renderGroup={(params) => {
            const type = params.group.toLowerCase();
            const SpeciesIcon = getSpeciesIcon(type);
            return (
              <li key={params.key}>
                <Box sx={{ px: 1.5, py: 0.5, bgcolor: 'grey.50', borderBottom: '1px solid', borderColor: 'divider' }}>
                  <Stack direction="row" alignItems="center" spacing={0.5}>
                    <SpeciesIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                    <Typography variant="caption" fontWeight={600} color="text.secondary">
                      {params.group}
                    </Typography>
                  </Stack>
                </Box>
                <ul style={{ padding: 0, margin: 0 }}>{params.children}</ul>
              </li>
            );
          }}
          getOptionLabel={(option) => {
            if (option.name) return `${option.name} ${option.scientific_name || ''}`.trim();
            return option.scientific_name || '';
          }}
          value={selectedSpecies}
          onChange={(_, newValue) => {
            setSelectedSpecies(newValue);
            if (newValue?.type !== 'bird') {
              setBirdFieldsList([{ sex: null, posture: null, singing: null }]);
            }
          }}
          renderOption={(props, option) => (
            <li {...props}>
              <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                {option.name ? (
                  <>
                    {option.name}
                    {option.scientific_name && (
                      <i style={{ color: '#666', marginLeft: '0.3rem', fontSize: '0.75rem' }}>{option.scientific_name}</i>
                    )}
                  </>
                ) : (
                  <i style={{ color: '#666' }}>{option.scientific_name}</i>
                )}
              </Typography>
            </li>
          )}
          renderInput={(params) => (
            <TextField
              {...params}
              placeholder="Select species..."
              size="small"
              sx={{
                '& .MuiInputBase-input': { fontSize: '0.8rem' },
              }}
            />
          )}
          size="small"
          disablePortal
          slotProps={{
            listbox: { sx: { maxHeight: '200px' } },
          }}
        />

        <TextField
          type="number"
          label="Count"
          value={count || ''}
          onChange={(e) => {
            const val = e.target.value;
            handleCountChange(val === '' ? 0 : Math.max(0, parseInt(val) || 0));
          }}
          onBlur={() => { if (count < 1) handleCountChange(1); }}
          size="small"
          inputProps={{ min: 1 }}
          sx={{
            width: 100,
            '& .MuiInputBase-input': { fontSize: '0.8rem' },
          }}
        />

        <Stack direction="row" spacing={1}>
          <Button
            variant="contained"
            size="small"
            onClick={handleAdd}
            disabled={!selectedSpecies}
            sx={{ textTransform: 'none', fontWeight: 600, flex: 1 }}
          >
            Add
          </Button>
          <Button
            variant="outlined"
            size="small"
            color="error"
            onClick={onDiscard}
            sx={{ textTransform: 'none', fontWeight: 600, flex: 1 }}
          >
            Discard
          </Button>
        </Stack>

        {/* Behaviour section — dropdown extends below popup */}
        {isBird && count > 0 && (
          <Box sx={{ position: 'relative' }}>
            <Box
              onClick={() => setBirdDetailsExpanded(!birdDetailsExpanded)}
              sx={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 0.5, userSelect: 'none' }}
            >
              <ExpandMoreIcon
                sx={{
                  fontSize: 18,
                  color: 'text.secondary',
                  transform: birdDetailsExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s',
                }}
              />
              <Typography variant="caption" color="text.secondary">
                Behaviour
              </Typography>
            </Box>
            {birdDetailsExpanded && (
              <Paper
                elevation={3}
                sx={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  mt: 0.5,
                  p: 1,
                  maxHeight: 160,
                  overflowY: 'auto',
                  overflowX: 'hidden',
                  zIndex: 1000,
                  borderRadius: 1,
                  whiteSpace: 'nowrap',
                  width: 'max-content',
                }}
              >
                <Stack spacing={1}>
                  {birdFieldsList.slice(0, count).map((bf, index) => (
                    <Stack key={index} direction="row" alignItems="center" spacing={1}>
                      {count > 1 && (
                        <Typography variant="caption" color="text.secondary" sx={{ minWidth: 16, textAlign: 'right' }}>
                          {index + 1}
                        </Typography>
                      )}
                      <BirdObservationFields
                        sex={bf.sex}
                        posture={bf.posture}
                        singing={bf.singing}
                        onChange={(fields) => handleBirdFieldChange(index, fields)}
                        compact
                      />
                    </Stack>
                  ))}
                </Stack>
              </Paper>
            )}
          </Box>
        )}
      </Stack>
    </Box>
  );
}

// Edit form for existing markers
function EditPopupForm({
  species,
  marker,
  onUpdate,
  onDelete,
}: {
  species: Species[];
  marker: MapMarker;
  onUpdate: (updates: Partial<Pick<DraftIndividualLocation, 'count' | 'sex' | 'posture' | 'singing' | 'birdFieldsList'>>) => void;
  onDelete: () => void;
}) {
  const sp = species.find((s) => s.id === marker.species_id);
  const speciesName = sp?.name || sp?.scientific_name || 'Unknown';
  const isBird = sp?.type === 'bird';
  const SpeciesIcon = getSpeciesIcon(sp?.type || 'insect');

  const birdFieldsList = marker.birdFieldsList || (isBird ? [{ sex: marker.sex, posture: marker.posture, singing: marker.singing }] : []);
  const [birdDetailsExpanded, setBirdDetailsExpanded] = useState(false);

  const handleCountChange = (newCount: number) => {
    if (isBird) {
      let updatedList = [...birdFieldsList];
      if (newCount > updatedList.length) {
        updatedList = [
          ...updatedList,
          ...Array.from({ length: newCount - updatedList.length }, () => ({
            sex: null as BirdSex | null,
            posture: null as BirdPosture | null,
            singing: null as boolean | null,
          })),
        ];
      } else if (newCount < updatedList.length && newCount > 0) {
        updatedList = updatedList.slice(0, newCount);
      }
      onUpdate({ count: newCount, birdFieldsList: updatedList });
    } else {
      onUpdate({ count: newCount });
    }
  };

  const handleBirdFieldChange = (index: number, fields: Partial<IndividualBirdFields>) => {
    const updatedList = [...birdFieldsList];
    updatedList[index] = { ...updatedList[index], ...fields };
    const first = updatedList[0];
    onUpdate({ birdFieldsList: updatedList, sex: first?.sex, posture: first?.posture, singing: first?.singing });
  };

  return (
    <Box
      onMouseDown={stopPropagation}
      onClick={stopPropagation}
      onDoubleClick={stopPropagation}
      onWheel={stopPropagation}
      sx={{ minWidth: 240, p: 0.5 }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <SpeciesIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
          <Typography variant="subtitle2" fontWeight={600} sx={{ fontSize: '0.85rem' }}>
            {speciesName}
          </Typography>
        </Stack>
        <IconButton size="small" onClick={onDelete} sx={{ color: 'error.main' }}>
          <DeleteIcon fontSize="small" />
        </IconButton>
      </Stack>

      <Stack spacing={1.5}>
        <Typography variant="caption" color="text.secondary">
          {marker.latitude.toFixed(6)}, {marker.longitude.toFixed(6)}
        </Typography>

        <TextField
          type="number"
          label="Count"
          value={marker.count || ''}
          onChange={(e) => {
            const val = e.target.value;
            const newCount = val === '' ? 0 : Math.max(0, parseInt(val) || 0);
            handleCountChange(newCount);
          }}
          onBlur={() => {
            if (marker.count < 1) handleCountChange(1);
          }}
          size="small"
          inputProps={{ min: 1 }}
          sx={{
            width: 100,
            '& .MuiInputBase-input': { fontSize: '0.8rem' },
          }}
        />

        {/* Behaviour section — dropdown extends below popup */}
        {isBird && marker.count > 0 && (
          <Box sx={{ position: 'relative' }}>
            <Box
              onClick={() => setBirdDetailsExpanded(!birdDetailsExpanded)}
              sx={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 0.5, userSelect: 'none' }}
            >
              <ExpandMoreIcon
                sx={{
                  fontSize: 18,
                  color: 'text.secondary',
                  transform: birdDetailsExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s',
                }}
              />
              <Typography variant="caption" color="text.secondary">
                Behaviour
              </Typography>
            </Box>
            {birdDetailsExpanded && (
              <Paper
                elevation={3}
                sx={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  mt: 0.5,
                  p: 1,
                  maxHeight: 160,
                  overflowY: 'auto',
                  overflowX: 'hidden',
                  zIndex: 1000,
                  borderRadius: 1,
                  whiteSpace: 'nowrap',
                  width: 'max-content',
                }}
              >
                <Stack spacing={1}>
                  {birdFieldsList.slice(0, marker.count).map((bf, index) => (
                    <Stack key={index} direction="row" alignItems="center" spacing={1}>
                      {marker.count > 1 && (
                        <Typography variant="caption" color="text.secondary" sx={{ minWidth: 16, textAlign: 'right' }}>
                          {index + 1}
                        </Typography>
                      )}
                      <BirdObservationFields
                        sex={bf.sex}
                        posture={bf.posture}
                        singing={bf.singing}
                        onChange={(fields) => handleBirdFieldChange(index, fields)}
                        compact
                      />
                    </Stack>
                  ))}
                </Stack>
              </Paper>
            )}
          </Box>
        )}
      </Stack>
    </Box>
  );
}

// View-only display for markers (read-only mode)
function ViewPopupContent({
  species,
  marker,
}: {
  species: Species[];
  marker: MapMarker;
}) {
  const sp = species.find((s) => s.id === marker.species_id);
  const scientificName = sp?.scientific_name;
  const isBird = sp?.type === 'bird';
  const SpeciesIcon = getSpeciesIcon(sp?.type || 'insect');

  const hasBirdFields = isBird && (marker.sex || marker.posture || marker.singing);

  return (
    <Box
      onMouseDown={stopPropagation}
      onClick={stopPropagation}
      onDoubleClick={stopPropagation}
      onWheel={stopPropagation}
      sx={{ minWidth: 200, p: 0.5 }}
    >
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
        <SpeciesIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
        <Box>
          <Typography variant="subtitle2" fontWeight={600} sx={{ fontSize: '0.85rem' }}>
            {sp?.name || scientificName || 'Unknown'}
          </Typography>
          {sp?.name && scientificName && (
            <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
              {scientificName}
            </Typography>
          )}
        </Box>
      </Stack>

      <Stack spacing={0.75}>
        <Typography variant="caption" color="text.secondary">
          {marker.latitude.toFixed(6)}, {marker.longitude.toFixed(6)}
        </Typography>

        <Typography variant="body2">
          Count: <strong>{marker.count}</strong>
        </Typography>

        {hasBirdFields && (
          <Stack direction="row" alignItems="center" spacing={0.5} flexWrap="wrap">
            {marker.sex && (
              <Chip
                icon={marker.sex === 'male' ? <MaleIcon sx={{ fontSize: 14 }} /> : <FemaleIcon sx={{ fontSize: 14 }} />}
                label={marker.sex === 'male' ? 'Male' : 'Female'}
                size="small"
                sx={{ height: 20, '& .MuiChip-label': { px: 0.5, fontSize: '0.7rem' } }}
              />
            )}
            {marker.posture && (
              <Chip
                icon={marker.posture === 'flying' ? <FlightIcon sx={{ fontSize: 14 }} /> : <NatureIcon sx={{ fontSize: 14 }} />}
                label={marker.posture === 'flying' ? 'Flying' : 'Perched'}
                size="small"
                sx={{ height: 20, '& .MuiChip-label': { px: 0.5, fontSize: '0.7rem' } }}
              />
            )}
            {marker.singing && (
              <Chip
                icon={<MusicNoteIcon sx={{ fontSize: 14 }} />}
                label="Singing"
                size="small"
                sx={{ height: 20, '& .MuiChip-label': { px: 0.5, fontSize: '0.7rem' } }}
              />
            )}
          </Stack>
        )}
      </Stack>
    </Box>
  );
}

// Grouped popup content for multiple species at same location
interface GroupedMarkerPopupContentProps {
  markers: MapMarker[];
  species: Species[];
  readOnly?: boolean;
  onUpdate?: (sightingTempId: string, individualTempId: string, updates: Partial<Pick<DraftIndividualLocation, 'count' | 'sex' | 'posture' | 'singing' | 'birdFieldsList'>>) => void;
  onDelete?: (sightingTempId: string, individualTempId: string) => void;
}

export function GroupedMarkerPopupContent({
  markers,
  species,
  readOnly = false,
  onDelete,
}: GroupedMarkerPopupContentProps) {
  // Sort markers by species name for consistent display
  const sortedMarkers = [...markers].sort((a, b) => {
    const spA = species.find((s) => s.id === a.species_id);
    const spB = species.find((s) => s.id === b.species_id);
    const nameA = spA?.name || spA?.scientific_name || '';
    const nameB = spB?.name || spB?.scientific_name || '';
    return nameA.localeCompare(nameB);
  });

  const firstMarker = sortedMarkers[0];
  const totalCount = markers.reduce((sum, m) => sum + m.count, 0);

  return (
    <Box
      onMouseDown={stopPropagation}
      onClick={stopPropagation}
      onDoubleClick={stopPropagation}
      onWheel={stopPropagation}
      sx={{ minWidth: 240, p: 0.5 }}
    >
      {/* Header with location and total */}
      <Stack spacing={0.5} sx={{ mb: 1.5, pb: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Typography variant="subtitle2" fontWeight={600}>
          {markers.length} species at this location
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {firstMarker.latitude.toFixed(6)}, {firstMarker.longitude.toFixed(6)}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Total count: {totalCount}
        </Typography>
      </Stack>

      {/* Scrollable list of species */}
      <Box sx={{ maxHeight: 250, overflowY: 'auto', mr: -0.5, pr: 0.5 }}>
        <Stack spacing={1}>
          {sortedMarkers.map((marker) => {
            const sp = species.find((s) => s.id === marker.species_id);
            const SpeciesIcon = getSpeciesIcon(sp?.type || 'insect');
            const isBird = sp?.type === 'bird';
            const hasBirdFields = isBird && (marker.sex || marker.posture || marker.singing);

            return (
              <Box
                key={marker.individualTempId}
                sx={{
                  p: 1,
                  bgcolor: 'grey.50',
                  borderRadius: 1,
                  '&:hover': { bgcolor: 'grey.100' },
                }}
              >
                <Stack direction="row" alignItems="flex-start" justifyContent="space-between">
                  <Stack direction="row" alignItems="center" spacing={0.75} sx={{ flex: 1, minWidth: 0 }}>
                    <SpeciesIcon sx={{ fontSize: 16, color: 'text.secondary', flexShrink: 0 }} />
                    <Box sx={{ minWidth: 0 }}>
                      <Typography
                        variant="body2"
                        fontWeight={600}
                        sx={{ fontSize: '0.8rem', lineHeight: 1.3 }}
                        noWrap
                      >
                        {sp?.name || sp?.scientific_name || 'Unknown'}
                      </Typography>
                      {sp?.name && sp?.scientific_name && (
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ fontStyle: 'italic', fontSize: '0.7rem' }}
                          noWrap
                        >
                          {sp.scientific_name}
                        </Typography>
                      )}
                    </Box>
                  </Stack>

                  <Stack direction="row" alignItems="center" spacing={0.5}>
                    <Chip
                      label={marker.count}
                      size="small"
                      sx={{
                        height: 20,
                        minWidth: 24,
                        bgcolor: 'primary.main',
                        color: 'white',
                        fontWeight: 600,
                        '& .MuiChip-label': { px: 0.75, fontSize: '0.7rem' },
                      }}
                    />
                    {!readOnly && onDelete && (
                      <IconButton
                        size="small"
                        onClick={() => onDelete(marker.sightingTempId, marker.individualTempId)}
                        sx={{ color: 'error.main', p: 0.25 }}
                      >
                        <DeleteIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    )}
                  </Stack>
                </Stack>

                {/* Bird fields if present */}
                {hasBirdFields && (
                  <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mt: 0.5, ml: 2.75 }} flexWrap="wrap">
                    {marker.sex && (
                      <Chip
                        label={marker.sex === 'male' ? 'M' : 'F'}
                        size="small"
                        sx={{
                          height: 16,
                          minWidth: 20,
                          fontWeight: 600,
                          '& .MuiChip-label': { px: 0.5, fontSize: '0.65rem' },
                        }}
                      />
                    )}
                    {marker.posture && (
                      <Chip
                        label={marker.posture === 'flying' ? 'Fly' : 'Pch'}
                        size="small"
                        sx={{
                          height: 16,
                          minWidth: 20,
                          fontWeight: 600,
                          '& .MuiChip-label': { px: 0.5, fontSize: '0.65rem' },
                        }}
                      />
                    )}
                    {marker.singing && (
                      <Chip
                        icon={<MusicNoteIcon sx={{ fontSize: 10 }} />}
                        label="Sing"
                        size="small"
                        sx={{
                          height: 16,
                          fontWeight: 600,
                          '& .MuiChip-label': { px: 0.25, fontSize: '0.65rem' },
                          '& .MuiChip-icon': { ml: 0.25 },
                        }}
                      />
                    )}
                  </Stack>
                )}
              </Box>
            );
          })}
        </Stack>
      </Box>
    </Box>
  );
}
