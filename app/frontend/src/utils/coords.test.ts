/**
 * Coordinate Parsing Utility Tests
 */

import { describe, it, expect } from 'vitest';
import {
  parseLatLng,
  parseGridRef,
  parseCoordinateInput,
  latLngToGridRef,
  resolveGridRefParts,
  extractCoordinateList,
} from './coords';

describe('parseLatLng', () => {
  it('parses comma-and-space separated coordinates', () => {
    expect(parseLatLng('51.12345, -2.34567')).toEqual({ ok: true, lat: 51.12345, lng: -2.34567 });
  });

  it('parses comma-only separated coordinates', () => {
    expect(parseLatLng('51.12345,-2.34567')).toEqual({ ok: true, lat: 51.12345, lng: -2.34567 });
  });

  it('parses whitespace-only separated coordinates', () => {
    expect(parseLatLng('51.12345 -2.34567')).toEqual({ ok: true, lat: 51.12345, lng: -2.34567 });
  });

  it('parses integer degrees', () => {
    expect(parseLatLng('51, -2')).toEqual({ ok: true, lat: 51, lng: -2 });
  });

  it('tolerates surrounding whitespace', () => {
    expect(parseLatLng('  51.1, -2.3  ')).toEqual({ ok: true, lat: 51.1, lng: -2.3 });
  });

  it('accepts boundary values', () => {
    expect(parseLatLng('90, 180')).toEqual({ ok: true, lat: 90, lng: 180 });
    expect(parseLatLng('-90, -180')).toEqual({ ok: true, lat: -90, lng: -180 });
  });

  it('rejects empty input', () => {
    expect(parseLatLng('').ok).toBe(false);
    expect(parseLatLng('   ').ok).toBe(false);
  });

  it('rejects a single number', () => {
    expect(parseLatLng('51.12345').ok).toBe(false);
  });

  it('rejects three numbers', () => {
    expect(parseLatLng('51.1, -2.3, 4.5').ok).toBe(false);
  });

  it('rejects non-numeric tokens', () => {
    expect(parseLatLng('fifty-one, minus-two').ok).toBe(false);
    expect(parseLatLng('51.1N, 2.3W').ok).toBe(false);
    expect(parseLatLng('51.1.2, -2.3').ok).toBe(false);
  });

  it('reports a format error distinct from range errors', () => {
    const format = parseLatLng('nonsense');
    const range = parseLatLng('91, 0');
    expect(format.ok).toBe(false);
    expect(range.ok).toBe(false);
    if (!format.ok && !range.ok) {
      expect(format.error).not.toBe(range.error);
    }
  });

  it('rejects out-of-range latitude', () => {
    const result = parseLatLng('90.0001, 0');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('Latitude');
    expect(parseLatLng('-91, 0').ok).toBe(false);
  });

  it('rejects out-of-range longitude', () => {
    const result = parseLatLng('0, 180.5');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('Longitude');
    expect(parseLatLng('0, -181').ok).toBe(false);
  });
});

describe('parseGridRef', () => {
  // Expected values computed with pyproj (EPSG:27700 -> EPSG:4326) for the
  // centre of each grid square; the Helmert transform agrees to within ~1 m,
  // so a 0.0001° (~10 m) tolerance is comfortable for 100 m squares.
  const expectClose = (result: ReturnType<typeof parseGridRef>, lat: number, lng: number) => {
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.kind).toBe('gridref');
      expect(result.lat).toBeCloseTo(lat, 4);
      expect(result.lng).toBeCloseTo(lng, 4);
    }
  };

  it('parses a compact six-figure reference', () => {
    expectClose(parseGridRef('ST734400'), 51.15908, -2.381038);
  });

  it('parses a spaced six-figure reference', () => {
    expectClose(parseGridRef('ST 734 400'), 51.15908, -2.381038);
  });

  it('is case-insensitive', () => {
    expectClose(parseGridRef('st734400'), 51.15908, -2.381038);
  });

  it('parses other squares from the Heal dragonfly route', () => {
    expectClose(parseGridRef('ST733399'), 51.158176, -2.382461);
    expectClose(parseGridRef('ST 740 394'), 51.153712, -2.372415);
    expectClose(parseGridRef('ST735401'), 51.159983, -2.379615);
  });

  it('parses references at other precisions', () => {
    // 4 figures = 1 km square, 8 figures = 10 m square; both centre on the
    // same neighbourhood as the 6-figure version.
    const oneKm = parseGridRef('ST7340');
    expect(oneKm.ok).toBe(true);
    if (oneKm.ok) expect(oneKm.lat).toBeCloseTo(51.1595, 2);
    expectClose(parseGridRef('ST 7345 4000'), 51.158675, -2.380963);
  });

  it('rejects an odd number of digits', () => {
    const result = parseGridRef('ST 7344 001');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('even number of digits');
  });

  it('rejects more than ten digits', () => {
    expect(parseGridRef('ST 734501 400502').ok).toBe(false);
  });

  it('rejects squares using the letter I', () => {
    const result = parseGridRef('SI 734 400');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('I');
  });

  it('rejects letter pairs outside the National Grid', () => {
    const result = parseGridRef('AA 123 456');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('outside');
  });
});

describe('parseCoordinateInput', () => {
  it('detects decimal lat/lng input', () => {
    expect(parseCoordinateInput('51.12345, -2.34567')).toEqual({
      ok: true,
      lat: 51.12345,
      lng: -2.34567,
      kind: 'latlng',
    });
  });

  it('detects grid reference input', () => {
    const result = parseCoordinateInput('ST 734 400');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.kind).toBe('gridref');
  });

  it('mentions both formats when unparseable input matches neither', () => {
    const result = parseCoordinateInput('nonsense!');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('decimal coordinates');
      expect(result.error).toContain('grid reference');
    }
  });

  it('keeps specific lat/lng range errors', () => {
    const result = parseCoordinateInput('91, 0');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('Latitude');
  });

  it('keeps specific grid reference errors', () => {
    const result = parseCoordinateInput('ST 734 4001');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('even number of digits');
  });
});

describe('latLngToGridRef', () => {
  it('round-trips the Heal dragonfly stops back to their printed references', () => {
    // Same fixtures parseGridRef converts the other way, so a break in either
    // direction shows up here.
    expect(latLngToGridRef(51.15908, -2.381038)?.ref).toBe('ST734400');
    expect(latLngToGridRef(51.158176, -2.382461)?.ref).toBe('ST733399');
    expect(latLngToGridRef(51.153712, -2.372415)?.ref).toBe('ST740394');
    expect(latLngToGridRef(51.159983, -2.379615)?.ref).toBe('ST735401');
  });

  it('splits the reference into the parts the entry fields use', () => {
    expect(latLngToGridRef(51.15908, -2.381038)).toMatchObject({
      square: 'ST',
      easting: '734',
      northing: '400',
    });
  });

  it('honours the requested precision', () => {
    expect(latLngToGridRef(51.15908, -2.381038, 4)?.ref).toBe('ST7340');
    // ST734400 denotes a 100 m square and parses to its centre (E 373450,
    // N 140050), so at 10 m precision that centre reads as 7345 / 4005.
    expect(latLngToGridRef(51.15908, -2.381038, 8)?.ref).toBe('ST73454005');
  });

  it('zero-pads figures so the digit count always matches the precision', () => {
    const parts = latLngToGridRef(51.15908, -2.381038, 8);
    expect(parts?.easting).toHaveLength(4);
    expect(parts?.northing).toHaveLength(4);
  });

  it('returns null outside the National Grid', () => {
    expect(latLngToGridRef(48.85, 2.35)).toBeNull(); // Paris
    expect(latLngToGridRef(-33.87, 151.21)).toBeNull(); // Sydney
  });

  it('survives a full round trip through parseGridRef', () => {
    const parsed = parseGridRef('SU 123 456');
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(latLngToGridRef(parsed.lat, parsed.lng)?.ref).toBe('SU123456');
  });
});

describe('resolveGridRefParts', () => {
  it('resolves the three fields to WGS84', () => {
    const result = resolveGridRefParts('ST', '734', '400');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.lat).toBeCloseTo(51.15908, 4);
      expect(result.lng).toBeCloseTo(-2.381038, 4);
    }
  });

  it('accepts a lowercase square and surrounding spaces', () => {
    const result = resolveGridRefParts(' st ', ' 734 ', ' 400 ');
    expect(result.ok).toBe(true);
  });

  it('names the empty field rather than rejecting the whole entry', () => {
    const noSquare = resolveGridRefParts('', '734', '400');
    expect(noSquare.ok).toBe(false);
    if (!noSquare.ok) expect(noSquare.error).toMatch(/two-letter grid square/i);

    const noFigures = resolveGridRefParts('ST', '', '');
    expect(noFigures.ok).toBe(false);
    if (!noFigures.ok) expect(noFigures.error).toMatch(/easting and northing/i);
  });

  it('rejects a mismatched number of figures, saying which counts differ', () => {
    const result = resolveGridRefParts('ST', '7345', '400');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('4 vs 3');
  });

  it('rejects a one-letter square', () => {
    expect(resolveGridRefParts('S', '734', '400').ok).toBe(false);
  });

  it('rejects non-digits in the figures', () => {
    expect(resolveGridRefParts('ST', '7a4', '400').ok).toBe(false);
  });

  it('still applies the square validation from parseGridRef', () => {
    expect(resolveGridRefParts('SI', '734', '400').ok).toBe(false); // I unused
    expect(resolveGridRefParts('AA', '123', '456').ok).toBe(false); // off-grid
  });
});

describe('extractCoordinateList', () => {
  it('pulls grid refs out of a pasted route-guidance document, in walking order', () => {
    const doc = [
      '1: ST734400 – Start from the office, cross the road and pass through the gate.',
      '2. ST734399 – Continue along mown path, head up and into next field.',
      '3. ST733399 – Cross stream, check banks and into field next to railway line.',
      'Retrace steps, cross back over the stream and head back to buildings.',
      '10. ST739398 – Head out the gate at the bottom (code 4321) and turn left.',
    ].join('\n');
    const result = extractCoordinateList(doc);
    expect(result.map((r) => r.source)).toEqual(['ST734400', 'ST734399', 'ST733399', 'ST739398']);
    expect(result.every((r) => r.ok)).toBe(true);
  });

  it('resolves an extracted ref to the same position as parseGridRef', () => {
    const [only] = extractCoordinateList('start at ST 734 400 please');
    expect(only.ok).toBe(true);
    const direct = parseGridRef('ST734400');
    if (only.ok && direct.ok) {
      expect(only.lat).toBeCloseTo(direct.lat, 10);
      expect(only.lng).toBeCloseTo(direct.lng, 10);
    }
  });

  it('extracts decimal degree pairs, mixed with grid refs, in reading order', () => {
    const result = extractCoordinateList('ST734400 then 51.15908, -2.38104\n51.16, -2.39');
    expect(result).toHaveLength(3);
    expect(result.map((r) => r.ok)).toEqual([true, true, true]);
    if (result[1].ok) expect(result[1].kind).toBe('latlng');
  });

  it('flags a coordinate-shaped token that does not resolve, rather than dropping it', () => {
    const result = extractCoordinateList('waypoint ST 73440 by the gate'); // 5 figures: typo
    expect(result).toHaveLength(1);
    expect(result[0].ok).toBe(false);
  });

  it('ignores prose, short letter-digit pairs, and empty text', () => {
    expect(extractCoordinateList('')).toEqual([]);
    expect(extractCoordinateList('Explore the 3 scrapes near gate code 4321')).toEqual([]);
    expect(extractCoordinateList('meet in room AB 12 at 10')).toEqual([]);
  });

  it('flags out-of-range decimal pairs as problems', () => {
    const result = extractCoordinateList('91.0, -2.3');
    expect(result).toHaveLength(1);
    expect(result[0].ok).toBe(false);
  });
});
