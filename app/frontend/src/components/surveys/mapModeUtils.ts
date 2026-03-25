import type { BirdSex, BirdPosture } from '../../services/api';
import type { DraftSighting } from './SightingsEditor';
import type { DraftIndividualLocation, IndividualBirdFields } from './MultiLocationMapPicker';

/**
 * Represents a single marker on the map: one species at one GPS location.
 * Each marker corresponds to exactly one DraftIndividualLocation within a DraftSighting.
 */
export interface MapMarker {
  sightingTempId: string;
  individualTempId: string;
  species_id: number;
  latitude: number;
  longitude: number;
  count: number;
  sex?: BirdSex | null;
  posture?: BirdPosture | null;
  singing?: boolean | null;
  birdFieldsList?: IndividualBirdFields[];
}

/**
 * Represents a group of markers at the same GPS location.
 * Used when multiple species are recorded at identical coordinates (e.g., from same audio device).
 */
export interface GroupedMarker {
  locationKey: string;
  latitude: number;
  longitude: number;
  markers: MapMarker[];
}

/**
 * Create a location key for grouping markers by exact coordinates.
 * Uses 6 decimal places (~0.1m precision).
 */
function getLocationKey(lat: number, lng: number): string {
  return `${lat.toFixed(6)}_${lng.toFixed(6)}`;
}

/**
 * Group markers by their exact GPS location.
 * Returns a list of GroupedMarker, each containing all markers at that location.
 */
export function groupMarkersByLocation(markers: MapMarker[]): GroupedMarker[] {
  const groups = new Map<string, GroupedMarker>();

  for (const marker of markers) {
    const key = getLocationKey(marker.latitude, marker.longitude);

    if (!groups.has(key)) {
      groups.set(key, {
        locationKey: key,
        latitude: marker.latitude,
        longitude: marker.longitude,
        markers: [],
      });
    }

    groups.get(key)!.markers.push(marker);
  }

  return Array.from(groups.values());
}

/**
 * Flatten all DraftIndividualLocation entries from draftSightings into a flat MapMarker list.
 * Only includes sightings that have a species_id and individuals with coordinates.
 */
export function getMarkersFromSightings(draftSightings: DraftSighting[]): MapMarker[] {
  const markers: MapMarker[] = [];

  for (const sighting of draftSightings) {
    if (sighting.species_id == null || !sighting.individuals) continue;

    for (const ind of sighting.individuals) {
      markers.push({
        sightingTempId: sighting.tempId,
        individualTempId: ind.tempId,
        species_id: sighting.species_id,
        latitude: ind.latitude,
        longitude: ind.longitude,
        count: ind.count,
        sex: ind.sex,
        posture: ind.posture,
        singing: ind.singing,
        birdFieldsList: ind.birdFieldsList,
      });
    }
  }

  return markers;
}

/**
 * Add a species at a GPS location. If a DraftSighting already exists for the species,
 * append a new individual to it and increment the total count. Otherwise create a new sighting.
 */
export function addSpeciesAtLocation(
  draftSightings: DraftSighting[],
  lat: number,
  lng: number,
  speciesId: number,
  count: number,
  birdFieldsList?: IndividualBirdFields[]
): DraftSighting[] {
  const firstBird = birdFieldsList?.[0];
  const newIndividual: DraftIndividualLocation = {
    tempId: `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    latitude: lat,
    longitude: lng,
    count,
    birdFieldsList: birdFieldsList,
    sex: firstBird?.sex ?? null,
    posture: firstBird?.posture ?? null,
    singing: firstBird?.singing ?? null,
  };

  const existingIndex = draftSightings.findIndex(
    (s) => s.species_id === speciesId
  );

  if (existingIndex >= 0) {
    // Append individual to existing sighting, increment total count
    return draftSightings.map((s, i) => {
      if (i !== existingIndex) return s;
      const individuals = [...(s.individuals || []), newIndividual];
      return {
        ...s,
        count: individuals.reduce((sum, ind) => sum + ind.count, 0),
        individuals,
      };
    });
  }

  // Create new sighting
  const newSighting: DraftSighting = {
    tempId: `temp-${Date.now()}`,
    species_id: speciesId,
    count,
    individuals: [newIndividual],
  };

  // Filter out empty placeholder rows (species_id === null, no individuals)
  // then add the new sighting
  const filtered = draftSightings.filter(
    (s) => s.species_id !== null || (s.individuals && s.individuals.length > 0)
  );

  return [...filtered, newSighting];
}

/**
 * Update a marker's fields (count, bird observation fields).
 * Recalculates the parent sighting's total count.
 */
export function updateMarker(
  draftSightings: DraftSighting[],
  sightingTempId: string,
  individualTempId: string,
  updates: Partial<Pick<DraftIndividualLocation, 'count' | 'sex' | 'posture' | 'singing' | 'birdFieldsList'>>
): DraftSighting[] {
  return draftSightings.map((s) => {
    if (s.tempId !== sightingTempId || !s.individuals) return s;

    const individuals = s.individuals.map((ind) => {
      if (ind.tempId !== individualTempId) return ind;
      return { ...ind, ...updates };
    });

    return {
      ...s,
      count: individuals.reduce((sum, ind) => sum + ind.count, 0),
      individuals,
    };
  });
}

/**
 * Expand a DraftIndividualLocation with birdFieldsList into multiple API-ready individual records.
 * Groups identical bird field combos to minimise records.
 * Returns records without birdFieldsList, ready for the API.
 */
export function expandBirdFieldsToIndividuals(
  ind: DraftIndividualLocation
): Array<{ latitude: number; longitude: number; count: number; sex?: BirdSex | null; posture?: BirdPosture | null; singing?: boolean | null; notes?: string | null }> {
  if (!ind.birdFieldsList || ind.birdFieldsList.length <= 1) {
    // No per-individual fields or just one — use single fields as-is
    const bf = ind.birdFieldsList?.[0];
    return [{
      latitude: ind.latitude,
      longitude: ind.longitude,
      count: ind.count,
      sex: bf?.sex ?? ind.sex,
      posture: bf?.posture ?? ind.posture,
      singing: bf?.singing ?? ind.singing,
      notes: ind.notes,
    }];
  }

  // Group by identical bird field combos
  const groups = new Map<string, { fields: IndividualBirdFields; count: number }>();
  for (const bf of ind.birdFieldsList) {
    const key = `${bf.sex ?? ''}_${bf.posture ?? ''}_${bf.singing ?? ''}`;
    const existing = groups.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      groups.set(key, { fields: bf, count: 1 });
    }
  }

  return Array.from(groups.values()).map(({ fields, count }) => ({
    latitude: ind.latitude,
    longitude: ind.longitude,
    count,
    sex: fields.sex,
    posture: fields.posture,
    singing: fields.singing,
    notes: ind.notes,
  }));
}

/**
 * Remove a marker (individual) from its parent sighting.
 * Recalculates count. Removes the sighting entirely if no individuals remain.
 */
export function removeMarker(
  draftSightings: DraftSighting[],
  sightingTempId: string,
  individualTempId: string
): DraftSighting[] {
  const result: DraftSighting[] = [];

  for (const s of draftSightings) {
    if (s.tempId !== sightingTempId) {
      result.push(s);
      continue;
    }

    const individuals = (s.individuals || []).filter(
      (ind) => ind.tempId !== individualTempId
    );

    if (individuals.length === 0) {
      // No individuals left — remove sighting entirely
      continue;
    }

    result.push({
      ...s,
      count: individuals.reduce((sum, ind) => sum + ind.count, 0),
      individuals,
    });
  }

  return result;
}
