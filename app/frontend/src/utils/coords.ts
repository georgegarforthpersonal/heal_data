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


/** Geodetic WGS84 -> OSGB36 lat/lon (radians), the inverse of osgb36ToWgs84. */
function wgs84ToOsgb36(latDeg: number, lngDeg: number): { lat: number; lon: number } {
  const a2 = 6378137.0;
  const b2 = 6356752.3142;
  const e22 = 1 - (b2 * b2) / (a2 * a2);
  const lat = latDeg * DEG;
  const lon = lngDeg * DEG;
  const sinLat = Math.sin(lat);
  const cosLat = Math.cos(lat);
  const nu = a2 / Math.sqrt(1 - e22 * sinLat * sinLat);
  const x = nu * cosLat * Math.cos(lon);
  const y = nu * cosLat * Math.sin(lon);
  const z = nu * (1 - e22) * sinLat;

  // Published WGS84 -> OSGB36 Helmert parameters
  const tx = -446.448;
  const ty = 125.157;
  const tz = -542.06;
  const s1 = 1 + 20.4894e-6;
  const rx = -0.1502 * ARCSEC;
  const ry = -0.247 * ARCSEC;
  const rz = -0.8421 * ARCSEC;
  const x2 = tx + x * s1 - y * rz + z * ry;
  const y2 = ty + x * rz + y * s1 - z * rx;
  const z2 = tz - x * ry + y * rx + z * s1;

  const a1 = 6377563.396;
  const b1 = 6356256.909;
  const e21 = 1 - (b1 * b1) / (a1 * a1);
  const p = Math.sqrt(x2 * x2 + y2 * y2);
  let outLat = Math.atan2(z2, p * (1 - e21));
  for (let i = 0; i < 10; i++) {
    const s = Math.sin(outLat);
    const nu1 = a1 / Math.sqrt(1 - e21 * s * s);
    outLat = Math.atan2(z2 + e21 * nu1 * s, p);
  }
  return { lat: outLat, lon: Math.atan2(y2, x2) };
}

/** Forward Transverse Mercator: OSGB36 lat/lon (radians) -> National Grid E/N. */
function osgb36ToOsGrid(lat: number, lon: number): { easting: number; northing: number } {
  const a = 6377563.396;
  const b = 6356256.909;
  const F0 = 0.9996012717;
  const lat0 = 49 * DEG;
  const lon0 = -2 * DEG;
  const N0 = -100000;
  const E0 = 400000;
  const e2 = 1 - (b * b) / (a * a);
  const n = (a - b) / (a + b);
  const n2 = n * n;
  const n3 = n2 * n;

  const sinLat = Math.sin(lat);
  const cosLat = Math.cos(lat);
  const tanLat = Math.tan(lat);
  const nu = (a * F0) / Math.sqrt(1 - e2 * sinLat * sinLat);
  const rho = (a * F0 * (1 - e2)) / Math.pow(1 - e2 * sinLat * sinLat, 1.5);
  const eta2 = nu / rho - 1;

  const Ma = (1 + n + (5 / 4) * n2 + (5 / 4) * n3) * (lat - lat0);
  const Mb = (3 * n + 3 * n2 + (21 / 8) * n3) * Math.sin(lat - lat0) * Math.cos(lat + lat0);
  const Mc = ((15 / 8) * n2 + (15 / 8) * n3) * Math.sin(2 * (lat - lat0)) * Math.cos(2 * (lat + lat0));
  const Md = (35 / 24) * n3 * Math.sin(3 * (lat - lat0)) * Math.cos(3 * (lat + lat0));
  const M = b * F0 * (Ma - Mb + Mc - Md);

  const t2 = tanLat * tanLat;
  const t4 = t2 * t2;
  const c3 = cosLat * cosLat * cosLat;
  const c5 = c3 * cosLat * cosLat;

  const I = M + N0;
  const II = (nu / 2) * sinLat * cosLat;
  const III = (nu / 24) * sinLat * c3 * (5 - t2 + 9 * eta2);
  const IIIA = (nu / 720) * sinLat * c5 * (61 - 58 * t2 + t4);
  const IV = nu * cosLat;
  const V = (nu / 6) * c3 * (nu / rho - t2);
  const VI = (nu / 120) * c5 * (5 - 18 * t2 + t4 + 14 * eta2 - 58 * t2 * eta2);

  const dl = lon - lon0;
  const dl2 = dl * dl;
  return {
    northing: I + II * dl2 + III * dl2 * dl2 + IIIA * dl2 * dl2 * dl2,
    easting: E0 + IV * dl + V * dl2 * dl + VI * dl2 * dl2 * dl,
  };
}

const GRID_LETTERS = 'ABCDEFGHJKLMNOPQRSTUVWXYZ';

export interface GridRefParts {
  /** Two-letter 100 km square, e.g. "ST". */
  square: string;
  /** Easting figures within the square, zero-padded to `digits / 2`. */
  easting: string;
  /** Northing figures within the square. */
  northing: string;
  /** The whole reference, e.g. "ST734400". */
  ref: string;
}

/**
 * Convert WGS84 degrees to an OS grid reference, or null outside the National
 * Grid. `digits` is the total figure count (6 = 100 m precision).
 */
export function latLngToGridRef(
  lat: number,
  lng: number,
  digits: 4 | 6 | 8 | 10 = 6,
): GridRefParts | null {
  const osgb = wgs84ToOsgb36(lat, lng);
  const { easting, northing } = osgb36ToOsGrid(osgb.lat, osgb.lon);
  if (!Number.isFinite(easting) || !Number.isFinite(northing)) return null;

  const e100 = Math.floor(easting / 100000);
  const n100 = Math.floor(northing / 100000);
  if (e100 < 0 || e100 > 6 || n100 < 0 || n100 > 12) return null;

  // Inverse of the letter-pair decoding in parseGridRef.
  const i1 = (19 - n100) - ((19 - n100) % 5) + Math.floor((e100 + 10) / 5);
  const i2 = ((19 - n100) * 5) % 25 + (e100 % 5);
  const square = GRID_LETTERS[i1] + GRID_LETTERS[i2];

  const half = digits / 2;
  const div = Math.pow(10, 5 - half);
  const eStr = String(Math.floor((easting % 100000) / div)).padStart(half, '0');
  const nStr = String(Math.floor((northing % 100000) / div)).padStart(half, '0');
  return { square, easting: eStr, northing: nStr, ref: `${square}${eStr}${nStr}` };
}

/**
 * Resolve the three grid-reference fields of the structured editor.
 *
 * Kept separate from parseGridRef so the UI can say which box is wrong rather
 * than rejecting one opaque string.
 */
export function resolveGridRefParts(
  square: string,
  easting: string,
  northing: string,
): ParseCoordinateResult {
  const sq = square.trim().toUpperCase();
  const e = easting.trim();
  const n = northing.trim();

  if (!sq) return { ok: false, error: 'Enter the two-letter grid square, e.g. ST' };
  if (!/^[A-Z]{2}$/.test(sq)) return { ok: false, error: 'The grid square is two letters, e.g. ST' };
  if (!e || !n) return { ok: false, error: 'Enter both easting and northing figures' };
  if (!/^\d{1,5}$/.test(e) || !/^\d{1,5}$/.test(n)) {
    return { ok: false, error: 'Easting and northing must be digits only' };
  }
  if (e.length !== n.length) {
    return {
      ok: false,
      error: `Easting and northing need the same number of digits (${e.length} vs ${n.length})`,
    };
  }
  return parseGridRef(`${sq}${e}${n}`);
}
