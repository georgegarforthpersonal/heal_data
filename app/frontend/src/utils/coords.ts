/**
 * Coordinate Parsing Utilities
 *
 * Parses manually-entered coordinates for precise location entry. Two input
 * formats are supported:
 *  - WGS84 decimal degrees, latitude first ("51.12345, -2.34567")
 *  - OS National Grid references ("ST 734 400", 2-10 figures)
 *
 * Grid references are converted to WGS84 via the standard inverse Transverse
 * Mercator projection on the Airy 1830 ellipsoid followed by a Helmert
 * transformation (OS "A guide to coordinate systems in Great Britain").
 * Accuracy is ~5 m, far finer than the grid squares being converted.
 */

export type ParseLatLngResult =
  | { ok: true; lat: number; lng: number }
  | { ok: false; error: string };

export type ParseCoordinateResult =
  | { ok: true; lat: number; lng: number; kind: 'latlng' | 'gridref' }
  | { ok: false; error: string };

const LAT_LNG_PATTERN = /^([+-]?\d{1,3}(?:\.\d+)?)(?:\s*,\s*|\s+)([+-]?\d{1,3}(?:\.\d+)?)$/;
const LAT_LNG_FORMAT_ERROR = 'Use decimal coordinates, e.g. 51.12345, -2.34567';

/**
 * Parse a coordinate pair like "51.12345, -2.34567" (comma and/or
 * whitespace separated decimal degrees, latitude first).
 */
export function parseLatLng(input: string): ParseLatLngResult {
  const match = input.trim().match(LAT_LNG_PATTERN);
  if (!match) {
    return { ok: false, error: LAT_LNG_FORMAT_ERROR };
  }

  const lat = parseFloat(match[1]);
  const lng = parseFloat(match[2]);

  if (lat < -90 || lat > 90) {
    return { ok: false, error: 'Latitude must be between -90 and 90' };
  }
  if (lng < -180 || lng > 180) {
    return { ok: false, error: 'Longitude must be between -180 and 180' };
  }

  return { ok: true, lat, lng };
}

const GRID_REF_PATTERN = /^([A-Za-z]{2})\s*([\d\s]+)$/;

const DEG = Math.PI / 180;
const ARCSEC = Math.PI / (180 * 3600);

/** Inverse Transverse Mercator: National Grid E/N -> OSGB36 lat/lon (radians). */
function osGridToOsgb36(E: number, N: number): { lat: number; lon: number } {
  const a = 6377563.396; // Airy 1830 semi-major/minor axes
  const b = 6356256.909;
  const F0 = 0.9996012717; // National Grid scale factor on central meridian
  const lat0 = 49 * DEG; // true origin: 49°N, 2°W
  const lon0 = -2 * DEG;
  const N0 = -100000; // northing/easting of true origin
  const E0 = 400000;
  const e2 = 1 - (b * b) / (a * a);
  const n = (a - b) / (a + b);
  const n2 = n * n;
  const n3 = n2 * n;

  let lat = lat0;
  let M = 0;
  do {
    lat = (N - N0 - M) / (a * F0) + lat;
    const Ma = (1 + n + (5 / 4) * n2 + (5 / 4) * n3) * (lat - lat0);
    const Mb = (3 * n + 3 * n2 + (21 / 8) * n3) * Math.sin(lat - lat0) * Math.cos(lat + lat0);
    const Mc =
      ((15 / 8) * n2 + (15 / 8) * n3) * Math.sin(2 * (lat - lat0)) * Math.cos(2 * (lat + lat0));
    const Md = (35 / 24) * n3 * Math.sin(3 * (lat - lat0)) * Math.cos(3 * (lat + lat0));
    M = b * F0 * (Ma - Mb + Mc - Md);
  } while (Math.abs(N - N0 - M) >= 0.00001);

  const sinLat = Math.sin(lat);
  const cosLat = Math.cos(lat);
  const tanLat = Math.tan(lat);
  const nu = (a * F0) / Math.sqrt(1 - e2 * sinLat * sinLat);
  const rho = (a * F0 * (1 - e2)) / Math.pow(1 - e2 * sinLat * sinLat, 1.5);
  const eta2 = nu / rho - 1;

  const tan2 = tanLat * tanLat;
  const tan4 = tan2 * tan2;
  const tan6 = tan4 * tan2;
  const secLat = 1 / cosLat;
  const nu3 = nu * nu * nu;
  const nu5 = nu3 * nu * nu;
  const nu7 = nu5 * nu * nu;

  const VII = tanLat / (2 * rho * nu);
  const VIII = (tanLat / (24 * rho * nu3)) * (5 + 3 * tan2 + eta2 - 9 * tan2 * eta2);
  const IX = (tanLat / (720 * rho * nu5)) * (61 + 90 * tan2 + 45 * tan4);
  const X = secLat / nu;
  const XI = (secLat / (6 * nu3)) * (nu / rho + 2 * tan2);
  const XII = (secLat / (120 * nu5)) * (5 + 28 * tan2 + 24 * tan4);
  const XIIA = (secLat / (5040 * nu7)) * (61 + 662 * tan2 + 1320 * tan4 + 720 * tan6);

  const dE = E - E0;
  const dE2 = dE * dE;
  const dE3 = dE2 * dE;
  const dE4 = dE2 * dE2;
  const dE5 = dE3 * dE2;
  const dE6 = dE4 * dE2;
  const dE7 = dE5 * dE2;

  return {
    lat: lat - VII * dE2 + VIII * dE4 - IX * dE6,
    lon: lon0 + X * dE - XI * dE3 + XII * dE5 - XIIA * dE7,
  };
}

/** Helmert datum shift: OSGB36 lat/lon (radians) -> WGS84 lat/lng (degrees). */
function osgb36ToWgs84(latRad: number, lonRad: number): { lat: number; lng: number } {
  // Geodetic -> cartesian on Airy 1830 (height 0)
  const a1 = 6377563.396;
  const b1 = 6356256.909;
  const e21 = 1 - (b1 * b1) / (a1 * a1);
  const sinLat1 = Math.sin(latRad);
  const cosLat1 = Math.cos(latRad);
  const nu1 = a1 / Math.sqrt(1 - e21 * sinLat1 * sinLat1);
  const x = nu1 * cosLat1 * Math.cos(lonRad);
  const y = nu1 * cosLat1 * Math.sin(lonRad);
  const z = nu1 * (1 - e21) * sinLat1;

  // Inverse of the published WGS84 -> OSGB36 Helmert parameters
  const tx = 446.448;
  const ty = -125.157;
  const tz = 542.06;
  const s1 = 1 + -20.4894e-6;
  const rx = 0.1502 * ARCSEC;
  const ry = 0.247 * ARCSEC;
  const rz = 0.8421 * ARCSEC;
  const x2 = tx + x * s1 - y * rz + z * ry;
  const y2 = ty + x * rz + y * s1 - z * rx;
  const z2 = tz - x * ry + y * rx + z * s1;

  // Cartesian -> geodetic on the WGS84 ellipsoid
  const a2 = 6378137.0;
  const b2 = 6356752.3142;
  const e22 = 1 - (b2 * b2) / (a2 * a2);
  const p = Math.sqrt(x2 * x2 + y2 * y2);
  let lat = Math.atan2(z2, p * (1 - e22));
  for (let i = 0; i < 10; i++) {
    const sinLat2 = Math.sin(lat);
    const nu2 = a2 / Math.sqrt(1 - e22 * sinLat2 * sinLat2);
    lat = Math.atan2(z2 + e22 * nu2 * sinLat2, p);
  }
  return { lat: lat / DEG, lng: Math.atan2(y2, x2) / DEG };
}

/**
 * Parse an OS National Grid reference like "ST734400" or "ST 7345 4002"
 * (2-10 figures) into WGS84 coordinates for the centre of the grid square.
 */
export function parseGridRef(input: string): ParseCoordinateResult {
  const match = input.trim().match(GRID_REF_PATTERN);
  if (!match) {
    return { ok: false, error: 'Use an OS grid reference, e.g. ST 734 400' };
  }

  const letters = match[1].toUpperCase();
  if (letters.includes('I')) {
    return { ok: false, error: `${letters} is not a valid OS grid square (the letter I is not used)` };
  }

  const digits = match[2].replace(/\s+/g, '');
  if (digits.length % 2 !== 0 || digits.length > 10) {
    return {
      ok: false,
      error: 'Grid references need an even number of digits (2-10), e.g. ST 734 400',
    };
  }

  // Each letter indexes a 5x5 grid of 100km squares (I skipped); the first
  // letter addresses 500km blocks, the second 100km squares within a block.
  const l1 = letters.charCodeAt(0) - 65 - (letters.charCodeAt(0) > 73 ? 1 : 0);
  const l2 = letters.charCodeAt(1) - 65 - (letters.charCodeAt(1) > 73 ? 1 : 0);
  const e100km = ((l1 - 2) % 5) * 5 + (l2 % 5);
  const n100km = 19 - Math.floor(l1 / 5) * 5 - Math.floor(l2 / 5);
  if (e100km < 0 || e100km > 6 || n100km < 0 || n100km > 12) {
    return { ok: false, error: `${letters} is outside the OS National Grid` };
  }

  // Split figures evenly into easting/northing and take the centre of the
  // square they denote (e.g. 6 figures = a 100m square, so offset by 50m).
  const half = digits.length / 2;
  const cell = Math.pow(10, 5 - half);
  const easting = e100km * 100000 + parseInt(digits.slice(0, half), 10) * cell + cell / 2;
  const northing = n100km * 100000 + parseInt(digits.slice(half), 10) * cell + cell / 2;

  const osgb = osGridToOsgb36(easting, northing);
  const { lat, lng } = osgb36ToWgs84(osgb.lat, osgb.lon);
  return { ok: true, lat, lng, kind: 'gridref' };
}

/**
 * Parse typed coordinates in either supported format: an OS grid reference
 * (two letters followed by figures) or decimal "lat, lng" degrees.
 */
export function parseCoordinateInput(input: string): ParseCoordinateResult {
  const trimmed = input.trim();
  if (GRID_REF_PATTERN.test(trimmed)) {
    return parseGridRef(trimmed);
  }
  const result = parseLatLng(trimmed);
  if (!result.ok) {
    return {
      ok: false,
      error:
        result.error === LAT_LNG_FORMAT_ERROR
          ? 'Use decimal coordinates (51.12345, -2.34567) or an OS grid reference (ST 734 400)'
          : result.error,
    };
  }
  return { ...result, kind: 'latlng' };
}

export interface ParsedCoordinatePoint {
  lat: number;
  lng: number;
  /** The text the coordinate was read from, for showing back to the user. */
  source: string;
}

export type ParseCoordinateListResult =
  | { ok: true; points: ParsedCoordinatePoint[] }
  | { ok: false; errors: string[] };

/** The coordinate at the start of a string, or undefined if there isn't one. */
function leadingCoordinate(text: string): string | undefined {
  return text.match(LEADING_GRID_REF)?.[1] ?? text.match(LEADING_LAT_LNG)?.[1];
}

// A leading list index: "1.", "2:", "3 -" and so on.
const LIST_INDEX = /^\s*\d{1,3}\s*[.):-]\s*/;
// The coordinate at the start of a line, ignoring any prose after it. Grid refs
// end at the first non-digit; lat/lng pairs at the end of the second number.
const LEADING_GRID_REF = /^([A-Za-z]{2}\s*\d[\d\s]*)/;
const LEADING_LAT_LNG = /^([+-]?\d{1,3}(?:\.\d+)?(?:\s*,\s*|\s+)[+-]?\d{1,3}(?:\.\d+)?)/;

/**
 * Parse a whole list of coordinates, one per line, into ordered points.
 *
 * Tolerant of text pasted straight out of a survey document: an optional list
 * index is stripped and any prose following the coordinate is ignored, so
 * "1: ST734400 - Start from the office, cross the road" reads as ST734400.
 * Blank lines are skipped. Either supported format may be used, and they may
 * be mixed.
 *
 * Returns every bad line at once rather than stopping at the first, so a long
 * paste can be fixed in one pass.
 */
export function parseCoordinateList(input: string): ParseCoordinateListResult {
  const points: ParsedCoordinatePoint[] = [];
  const errors: string[] = [];

  input.split(/\r?\n/).forEach((rawLine, index) => {
    const line = rawLine.trim();
    if (!line) return;

    // Try the line as it stands before stripping any list index: a decimal
    // latitude like "51.15908, -2.3" itself begins "51.", which would
    // otherwise be mistaken for the index "51.".
    const token = leadingCoordinate(line) ?? leadingCoordinate(line.replace(LIST_INDEX, '').trim());
    if (!token) {
      errors.push(`Line ${index + 1}: could not read a coordinate from "${line}"`);
      return;
    }

    const parsed = parseCoordinateInput(token.trim());
    if (!parsed.ok) {
      errors.push(`Line ${index + 1}: ${parsed.error}`);
      return;
    }
    points.push({ lat: parsed.lat, lng: parsed.lng, source: token.trim() });
  });

  if (errors.length > 0) return { ok: false, errors };
  if (points.length === 0) {
    return { ok: false, errors: ['Enter at least one coordinate, one per line.'] };
  }
  return { ok: true, points };
}
