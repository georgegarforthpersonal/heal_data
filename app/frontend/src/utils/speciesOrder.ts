import type { Species } from '../services/api';

/**
 * Order a species list for field entry: grouped by species type (the
 * Autocomplete group headers need contiguous groups), then — within a type —
 * species already recorded this session first (most recent first), then the
 * ones most often recorded for this survey type (`sightings_count` from the
 * API), then alphabetical.
 *
 * The aim is that with wet hands on a phone the next species you need is
 * near the top of the list rather than buried in an A–Z of everything.
 */
export function orderSpeciesForEntry(species: Species[], recentIds: number[] = []): Species[] {
  const recentRank = new Map(recentIds.map((id, i) => [id, i]));
  return [...species].sort((a, b) => {
    if (a.type !== b.type) return a.type.localeCompare(b.type);
    const ra = recentRank.get(a.id) ?? Infinity;
    const rb = recentRank.get(b.id) ?? Infinity;
    if (ra !== rb) return ra - rb;
    const ca = a.sightings_count ?? 0;
    const cb = b.sightings_count ?? 0;
    if (ca !== cb) return cb - ca;
    const nameA = a.name || a.scientific_name || '';
    const nameB = b.name || b.scientific_name || '';
    return nameA.localeCompare(nameB);
  });
}

/**
 * Species recorded in the current entry session, most recently entered first —
 * feeds `orderSpeciesForEntry` so just-used species float to the top.
 */
export function recentSpeciesIds(sightings: Array<{ species_id: number | null }>): number[] {
  const seen = new Set<number>();
  const ids: number[] = [];
  for (let i = sightings.length - 1; i >= 0; i--) {
    const id = sightings[i].species_id;
    if (id !== null && !seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  }
  return ids;
}
