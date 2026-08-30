import { describe, it, expect } from 'vitest';
import { orderSpeciesForEntry, recentSpeciesIds } from './speciesOrder';
import type { Species } from '../services/api';

const sp = (id: number, name: string, type = 'bird', sightings_count = 0): Species => ({
  id,
  name,
  scientific_name: null,
  conservation_status: null,
  species_type_id: 1,
  type,
  species_code: null,
  sightings_count,
});

describe('orderSpeciesForEntry', () => {
  it('orders by frequency then name within a type', () => {
    const list = [sp(1, 'Avocet', 'bird', 0), sp(2, 'Wren', 'bird', 12), sp(3, 'Robin', 'bird', 12)];
    expect(orderSpeciesForEntry(list).map((s) => s.name)).toEqual(['Robin', 'Wren', 'Avocet']);
  });

  it('puts recently used species first, in recency order', () => {
    const list = [sp(1, 'Avocet', 'bird', 50), sp(2, 'Wren', 'bird', 0), sp(3, 'Robin', 'bird', 0)];
    expect(orderSpeciesForEntry(list, [3, 2]).map((s) => s.name)).toEqual(['Robin', 'Wren', 'Avocet']);
  });

  it('keeps species types contiguous for Autocomplete groups', () => {
    const list = [sp(1, 'Wren', 'bird', 0), sp(2, 'Peacock', 'butterfly', 99), sp(3, 'Robin', 'bird', 1)];
    expect(orderSpeciesForEntry(list, [1]).map((s) => s.name)).toEqual(['Wren', 'Robin', 'Peacock']);
  });
});

describe('recentSpeciesIds', () => {
  it('returns most recent first, deduplicated, skipping empty rows', () => {
    const sightings = [
      { species_id: 5 },
      { species_id: 7 },
      { species_id: 5 },
      { species_id: null },
    ];
    expect(recentSpeciesIds(sightings)).toEqual([5, 7]);
  });
});
