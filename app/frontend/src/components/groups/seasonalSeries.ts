/**
 * Transform per-survey occurrence counts into a season-over-season series:
 * every survey is placed on a shared Jan–Dec axis by its month/day, with one
 * series per year. Points are only ever joined within a year, so a winter gap
 * between field seasons never draws a misleading connecting line, and a year
 * with a single survey still shows as a dot.
 */
import type { SpeciesOccurrenceDataPoint } from '../../services/api';

/** Fixed non-leap year used to place month/day on the shared x axis. */
const REF_YEAR = 2001;

/**
 * The years a chart should show, most recent first, capped at
 * MAX_SEASON_YEARS.
 *
 * Leading years in which the species was never actually seen are dropped —
 * surveying started before the first record, and a flat zero line burns a
 * colour and a legend entry to say "nothing here". Zero years AFTER the first
 * record are kept: "we looked and found none" is a real result. If nothing
 * was ever recorded, every year stays so the chart still shows the zero line.
 */
export function seasonYears(data: SpeciesOccurrenceDataPoint[]): { years: number[]; truncated: boolean } {
  const yearOf = (d: SpeciesOccurrenceDataPoint) => Number(d.survey_date.slice(0, 4));
  const allYears = Array.from(new Set(data.map(yearOf))).sort((a, b) => b - a);
  const productive = data.filter((d) => d.occurrence_count > 0).map(yearOf);
  const firstProductive = productive.length > 0 ? Math.min(...productive) : null;
  const candidates = firstProductive == null ? allYears : allYears.filter((y) => y >= firstProductive);
  const years = candidates.slice(0, MAX_SEASON_YEARS);
  return { years, truncated: candidates.length > years.length };
}

/** Colour per year series, most recent year first (validated categorical set —
 * the brand green stays on the current season). */
export const YEAR_SERIES_COLORS = ['#3D8B56', '#4E7CC7', '#C2703A', '#955FC0', '#99862A'] as const;

/** Dash pattern per year series, same index as YEAR_SERIES_COLORS: the
 * current season is solid, earlier seasons get distinct dashes so years are
 * never distinguished by hue alone (green/olive and orange/olive collide
 * for red-green colour-blind readers). */
export const YEAR_SERIES_DASHES = [undefined, '6 3', '2 3', '8 3 2 3', '10 4'] as const;

/** Older seasons beyond this many years are dropped from the chart. */
export const MAX_SEASON_YEARS = YEAR_SERIES_COLORS.length;

export interface SeasonalRow {
  /** Timestamp of the survey's month/day in the reference year. */
  x: number;
  /** Per-year counts, keyed by the year as a string (e.g. "2026"). */
  [year: string]: number;
}

export interface SeasonalSeries {
  rows: SeasonalRow[];
  /** Years shown, most recent first (at most MAX_SEASON_YEARS). */
  years: number[];
  /** True when older years were dropped to stay within MAX_SEASON_YEARS. */
  truncated: boolean;
  /** First-of-month tick timestamps spanning the surveyed months. */
  monthTicks: number[];
  /** Padded x-axis domain: start/end of the surveyed months. */
  domain: [number, number];
}

function refTimestamp(isoDate: string): { x: number; year: number } {
  const [y, m, d] = isoDate.split('-').map(Number);
  // 29 Feb has no slot in the non-leap reference year; use 28 Feb.
  const day = m === 2 && d === 29 ? 28 : d;
  return { x: new Date(REF_YEAR, m - 1, day).getTime(), year: y };
}

/**
 * Aggregate to monthly peaks when any shown year has more surveys than this
 * (~fortnightly coverage). Sparse seasonal programmes keep per-survey dots —
 * with eight visits a season every dot is the data; with weekly surveys the
 * raw counts are visit-to-visit noise and the seasonal shape drowns.
 */
export const MONTHLY_AGGREGATION_THRESHOLD = 16;

export function shouldAggregateMonthly(data: SpeciesOccurrenceDataPoint[]): boolean {
  // Only the years the chart will actually show count — a dense season the
  // 5-year cap drops mustn't force sparse shown years into monthly mode.
  const shown = new Set(seasonYears(data).years);
  const perYear = new Map<number, number>();
  for (const d of data) {
    const year = Number(d.survey_date.slice(0, 4));
    if (!shown.has(year)) continue;
    perYear.set(year, (perYear.get(year) ?? 0) + 1);
  }
  return Array.from(perYear.values()).some((n) => n > MONTHLY_AGGREGATION_THRESHOLD);
}

/**
 * Monthly-peak variant for densely surveyed species: one point per surveyed
 * month per year — the highest single count that month (the bird-recording
 * "peak count" convention, e.g. WeBS). A month with surveys but no
 * individuals is an honest zero; a month with no surveys stays a gap.
 */
export function buildMonthlyPeakSeries(data: SpeciesOccurrenceDataPoint[]): SeasonalSeries | null {
  if (data.length === 0) return null;

  const { years, truncated } = seasonYears(data);
  const shown = new Set(years);

  // One row per calendar month, placed mid-month on the shared axis.
  const byMonth = new Map<number, SeasonalRow>();
  for (const point of data) {
    const [y, m] = point.survey_date.split('-').map(Number);
    if (!shown.has(y)) continue;
    const x = new Date(REF_YEAR, m - 1, 15).getTime();
    const row = byMonth.get(x) ?? { x };
    const key = String(y);
    row[key] = Math.max(row[key] ?? 0, point.occurrence_count);
    byMonth.set(x, row);
  }

  const rows = Array.from(byMonth.values()).sort((a, b) => a.x - b.x);
  if (rows.length === 0) return null;
  const first = new Date(rows[0].x);
  const last = new Date(rows[rows.length - 1].x);
  const monthTicks: number[] = [];
  for (let m = first.getMonth(); m <= last.getMonth(); m++) {
    monthTicks.push(new Date(REF_YEAR, m, 1).getTime());
  }
  const domain: [number, number] = [
    new Date(REF_YEAR, first.getMonth(), 1).getTime(),
    new Date(REF_YEAR, last.getMonth() + 1, 0).getTime(),
  ];

  return {
    rows,
    years,
    truncated,
    monthTicks,
    domain,
  };
}

export function buildSeasonalSeries(data: SpeciesOccurrenceDataPoint[]): SeasonalSeries | null {
  if (data.length === 0) return null;

  const { years, truncated } = seasonYears(data);
  const shown = new Set(years);

  // Two surveys of the same year on the same day merge into one point (sum).
  const byX = new Map<number, SeasonalRow>();
  for (const point of data) {
    const { x, year } = refTimestamp(point.survey_date);
    if (!shown.has(year)) continue;
    const row = byX.get(x) ?? { x };
    const key = String(year);
    row[key] = (row[key] ?? 0) + point.occurrence_count;
    byX.set(x, row);
  }

  const rows = Array.from(byX.values()).sort((a, b) => a.x - b.x);
  if (rows.length === 0) return null;

  // Month-start ticks from the first to the last surveyed month, and a domain
  // padded to whole months so the field season fills the chart.
  const first = new Date(rows[0].x);
  const last = new Date(rows[rows.length - 1].x);
  const monthTicks: number[] = [];
  for (let m = first.getMonth(); m <= last.getMonth(); m++) {
    monthTicks.push(new Date(REF_YEAR, m, 1).getTime());
  }
  const domain: [number, number] = [
    new Date(REF_YEAR, first.getMonth(), 1).getTime(),
    new Date(REF_YEAR, last.getMonth() + 1, 0).getTime(),
  ];

  return {
    rows,
    years,
    truncated,
    monthTicks,
    domain,
  };
}
