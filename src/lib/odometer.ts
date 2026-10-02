import type { Ymd } from './time';
import { parseYmd, DAY } from './time';

/** A point on a car's odometer: a reading, or the mileage written on a service visit. */
export interface OdometerPoint {
  date: Ymd;
  reading: number;
}

/** The most recent point: latest date, and on the same day the higher reading. */
export function latestReading(points: OdometerPoint[]): OdometerPoint | null {
  let best: OdometerPoint | null = null;
  for (const p of points) {
    if (parseYmd(p.date) === null) continue;
    if (!best || p.date > best.date || (p.date === best.date && p.reading > best.reading)) best = p;
  }
  return best;
}

/** How far back the pace looks. */
const PACE_WINDOW_DAYS = 365;
/** Fewer days than this between the first and last point is too little to judge a pace. */
const MIN_PACE_DAYS = 14;

/**
 * The car's recent pace in distance per day, from the oldest point within a year of the latest to
 * the latest. Null without two points at least two weeks apart, or when the odometer went nowhere.
 */
export function dailyPace(points: OdometerPoint[]): number | null {
  const latest = latestReading(points);
  if (!latest) return null;
  const end = parseYmd(latest.date)!;
  let first: { t: number; reading: number } | null = null;
  for (const p of points) {
    const t = parseYmd(p.date);
    if (t === null || t > end || end - t > PACE_WINDOW_DAYS * DAY) continue;
    if (!first || t < first.t || (t === first.t && p.reading < first.reading)) first = { t, reading: p.reading };
  }
  if (!first) return null;
  const days = Math.round((end - first.t) / DAY);
  const distance = latest.reading - first.reading;
  if (days < MIN_PACE_DAYS || distance <= 0) return null;
  return distance / days;
}
