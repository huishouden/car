import type { DistanceUnit } from './distance';
import { formatDistance } from './distance';
import type { ServiceItemData } from './model';
import { afterUsage, usageDue, type MeterReading, type UsageState } from '@huishouden/pwa-kit/schedule';
import { daysAgo, daysUntil, formatSpan, inDays, type Ymd } from '@huishouden/pwa-kit/time';
import { formatList } from '@huishouden/pwa-kit/i18n';
import { t } from '../i18n';

// When a service item is next due: by time (every N months from the last time), by distance
// (every N miles from the odometer then), whichever comes first. The arithmetic is the kit's
// usage schedule (@huishouden/pwa-kit/schedule); the wording and the defaults are Car's.

export type DueState = UsageState;

/** Within this many days, an item counts as coming up soon. */
export const SOON_DAYS = 30;
/** Within this share of the distance interval, an item counts as coming up soon. */
export const SOON_SHARE = 0.1;

export interface ServiceDue {
  state: DueState;
  /** The time-based due day, when it repeats by time and the last time is known. */
  dueDate: Ymd | null;
  /** Calendar days to `dueDate`; negative once it has passed. */
  daysLeft: number | null;
  /** The odometer reading it is due at, when it repeats by distance and the last reading is known. */
  dueAt: number | null;
  /** Distance left to `dueAt` from the latest reading; negative once passed. */
  distanceLeft: number | null;
  /** Days until `distanceLeft` runs out at the car's recent pace. */
  distanceDays: number | null;
  /** Days until due by whichever comes first; for sorting. Infinity when nothing is known. */
  sortDays: number;
}

type Schedule = Pick<ServiceItemData, 'everyMonths' | 'everyDistance' | 'lastDate' | 'lastOdometer'>;

export function serviceDue(item: Schedule, latest: MeterReading | null, pace: number | null, now: number): ServiceDue {
  const due = usageDue(
    { everyMonths: item.everyMonths, everyMeter: item.everyDistance, lastDate: item.lastDate, lastReading: item.lastOdometer },
    latest,
    pace,
    now,
    { soonDays: SOON_DAYS, soonShare: SOON_SHARE },
  );
  const { state, dueDate, daysLeft, dueAt, meterLeft: distanceLeft, meterDays: distanceDays, sortDays } = due;
  return { state, dueDate, daysLeft, dueAt, distanceLeft, distanceDays, sortDays };
}

/**
 * The glanceable line: "Oil change due in 600 miles or 3 weeks", "Tire rotation due in 1,200 miles
 * (about 5 weeks)", "Inspection overdue by 2 weeks", "Wiper blades: no record yet".
 */
export function dueText(name: string, due: ServiceDue, unit: DistanceUnit): string {
  const { daysLeft, distanceLeft, distanceDays } = due;
  if (due.state === 'unknown') return t('due.unknown', { name });
  if (due.state === 'overdue') {
    const over: string[] = [];
    if (distanceLeft !== null && distanceLeft < 0) over.push(formatDistance(-distanceLeft, unit));
    if (daysLeft !== null && daysLeft < 0) over.push(formatSpan(-daysLeft));
    return t('due.overdue', { name, amount: formatList(over) });
  }
  if (distanceLeft === 0) return t('due.now', { name });
  if (distanceLeft !== null && daysLeft !== null) {
    const distance = formatDistance(distanceLeft, unit);
    if (daysLeft === 0) return t('due.distanceOrToday', { name, distance });
    if (daysLeft === 1) return t('due.distanceOrTomorrow', { name, distance });
    return t('due.distanceOrSpan', { name, distance, span: formatSpan(daysLeft) });
  }
  if (distanceLeft !== null) {
    const distance = formatDistance(distanceLeft, unit);
    return distanceDays !== null ? t('due.distanceAbout', { name, distance, span: formatSpan(Math.max(distanceDays, 1)) }) : t('due.distance', { name, distance });
  }
  return t('due.when', { name, when: inDays(daysLeft!) });
}

/** "Every 6 months or 5,000 miles", "Every 12 months", "Every 7,500 miles". */
export function describeInterval(item: Pick<ServiceItemData, 'everyMonths' | 'everyDistance'>, unit: DistanceUnit): string {
  const m = item.everyMonths;
  const period = !m ? null : m === 1 ? 'month' : m === 12 ? 'year' : m % 12 === 0 && m > 12 ? 'years' : 'months';
  const n = period === 'years' ? m! / 12 : (m ?? 0);
  const distance = item.everyDistance ? formatDistance(item.everyDistance, unit) : null;
  if (period && distance) return t('interval.timeOrDistance', { period, n, distance });
  if (period) return t('interval.time', { period, n });
  if (distance) return t('interval.distance', { distance });
  return t('interval.none');
}

/** "Last done 3 months ago at 41,200 miles", "Last done at 41,200 miles", or null. */
export function describeLast(item: Pick<ServiceItemData, 'lastDate' | 'lastOdometer'>, unit: DistanceUnit, now: number): string | null {
  const when = item.lastDate ? daysAgo(-daysUntil(item.lastDate, now)) : null;
  const at = item.lastOdometer !== undefined ? formatDistance(item.lastOdometer, unit) : null;
  if (when && at) return t('last.whenAt', { when, distance: at });
  if (when) return t('last.when', { when });
  if (at) return t('last.at', { distance: at });
  return null;
}

/** The schedule fields a visit on `date` at `odometer` writes, unless the item has a later record. */
export function afterVisit(item: Schedule, date: Ymd, odometer: number | undefined): Pick<ServiceItemData, 'lastDate' | 'lastOdometer'> | null {
  const next = afterUsage({ lastDate: item.lastDate, lastReading: item.lastOdometer }, date, odometer);
  if (!next) return null;
  return { lastDate: next.lastDate, ...('lastReading' in next ? { lastOdometer: next.lastReading } : {}) };
}

/** The usual schedule a new car starts with; distances in miles, converted by the caller. */
const SCHEDULE = [
  { key: 'item.oil', everyMonths: 6, everyMiles: 5000 },
  { key: 'item.tires', everyMonths: 6, everyMiles: 6000 },
  { key: 'item.inspection', everyMonths: 12 },
  { key: 'item.wipers', everyMonths: 12 },
] as const;

/** The usual schedule, named in the page's language: written once, the household's own text after that. */
export const defaultSchedule = (): { name: string; everyMonths?: number; everyMiles?: number }[] =>
  SCHEDULE.map(({ key, ...rest }) => ({ name: t(key), ...rest }));

/** Names offered for a new service item, in the page's language. */
export const serviceSuggestions = (): string[] =>
  (['item.oil', 'item.tires', 'item.inspection', 'item.wipers', 'item.brakes', 'item.engineFilter', 'item.cabinFilter', 'item.battery'] as const).map((k) => t(k));
