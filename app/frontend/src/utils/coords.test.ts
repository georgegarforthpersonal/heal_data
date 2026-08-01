/**
 * Coordinate Parsing Utility Tests
 */

import { describe, it, expect } from 'vitest';
import {
  parseLatLng,
  parseGridRef,
  parseCoordinateInput,
  parseCoordinateList,
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

describe('parseCoordinateList', () => {
  it('reads one coordinate per line', () => {
    const result = parseCoordinateList('ST734400\nST734399\nST733399');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.points).toHaveLength(3);
      expect(result.points[0].lat).toBeCloseTo(51.15908, 4);
      expect(result.points[2].lng).toBeCloseTo(-2.382461, 4);
    }
  });

  it('keeps the order given, which is the walking order of the route', () => {
    const result = parseCoordinateList('ST733399\nST734400');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.points.map((p) => p.source)).toEqual(['ST733399', 'ST734400']);
    }
  });

  it('reads lines pasted straight out of the survey document', () => {
    // Verbatim from "Heal Somerset - DRAGONFLY survey route v2.pdf".
    const pasted = [
      '1: ST734400 – Start from the office, cross the road and pass through the gate.',
      '2. ST734399 – Continue along mown path, head up and into next field.',
      '3. ST733399 – Cross stream, check banks and into field next to railway line.',
    ].join('\n');

    const result = parseCoordinateList(pasted);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.points.map((p) => p.source)).toEqual(['ST734400', 'ST734399', 'ST733399']);
    }
  });

  it('skips blank lines', () => {
    const result = parseCoordinateList('ST734400\n\n   \nST734399\n');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.points).toHaveLength(2);
  });

  it('accepts decimal coordinates and a mix of both formats', () => {
    const result = parseCoordinateList('51.15908, -2.381038\nST734399');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.points).toHaveLength(2);
      expect(result.points[0].lat).toBeCloseTo(51.15908, 4);
    }
  });

  it('accepts spaced grid references within a list', () => {
    const result = parseCoordinateList('ST 734 400\nST 733 399');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.points).toHaveLength(2);
  });

  it('reports every bad line at once, with its line number', () => {
    const result = parseCoordinateList('ST734400\nnot a coordinate\nST733399\nZZ999999');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toHaveLength(2);
      expect(result.errors[0]).toContain('Line 2');
      expect(result.errors[1]).toContain('Line 4');
    }
  });

  it('rejects an empty list', () => {
    expect(parseCoordinateList('').ok).toBe(false);
    expect(parseCoordinateList('\n  \n').ok).toBe(false);
  });

  it('does not mistake prose for a coordinate', () => {
    const result = parseCoordinateList('Start from the office and cross the road');
    expect(result.ok).toBe(false);
  });
});
