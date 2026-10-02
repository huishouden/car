import type { DistanceUnit } from './distance';
import { formatDistance } from './distance';
import type { ServiceItemData } from './model';
import { afterUsage, usageDue, type MeterReading, type UsageState } from '@huishouden/pwa-kit/schedule';
import { daysAgo, daysUntil, formatSpan, inDays, type Ymd } from '@huishouden/pwa-kit/time';

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
 * (about 5 weeks)", "Inspection overdue by 2 weeks", "Wiper blades: when were they last done?".
 */
export function dueText(name: string, due: ServiceDue, unit: DistanceUnit): string {
  const { daysLeft, distanceLeft, distanceDays } = due;
  if (due.state === 'unknown') return `${name}: no record yet`;
  if (due.state === 'overdue') {
    const over: string[] = [];
    if (distanceLeft !== null && distanceLeft < 0) over.push(formatDistance(-distanceLeft, unit));
    if (daysLeft !== null && daysLeft < 0) over.push(formatSpan(-daysLeft));
    return `${name} overdue by ${over.join(' and ')}`;
  }
  if (distanceLeft === 0) return `${name} due now`;
  const when = daysLeft === null ? null : daysLeft === 0 ? 'today' : daysLeft === 1 ? 'tomorrow' : formatSpan(daysLeft);
  if (distanceLeft !== null && when !== null) return `${name} due in ${formatDistance(distanceLeft, unit)} or ${when}`;
  if (distanceLeft !== null)
    return `${name} due in ${formatDistance(distanceLeft, unit)}${distanceDays !== null ? ` (about ${formatSpan(Math.max(distanceDays, 1))})` : ''}`;
  return `${name} due ${inDays(daysLeft!)}`;
}

/** "Every 6 months or 5,000 miles", "Every 12 months", "Every 7,500 miles". */
export function describeInterval(item: Pick<ServiceItemData, 'everyMonths' | 'everyDistance'>, unit: DistanceUnit): string {
  const parts: string[] = [];
  if (item.everyMonths) parts.push(item.everyMonths === 1 ? 'month' : item.everyMonths === 12 ? 'year' : item.everyMonths % 12 === 0 && item.everyMonths > 12 ? `${item.everyMonths / 12} years` : `${item.everyMonths} months`);
  if (item.everyDistance) parts.push(formatDistance(item.everyDistance, unit));
  return parts.length ? `Every ${parts.join(' or ')}` : 'No schedule';
}

/** "Last done 3 months ago at 41,200 miles", "Last done at 41,200 miles", or null. */
export function describeLast(item: Pick<ServiceItemData, 'lastDate' | 'lastOdometer'>, unit: DistanceUnit, now: number): string | null {
  const when = item.lastDate ? daysAgo(-daysUntil(item.lastDate, now)) : null;
  const at = item.lastOdometer !== undefined ? `at ${formatDistance(item.lastOdometer, unit)}` : null;
  if (!when && !at) return null;
  return `Last done ${[when === 'today' ? 'today' : when, at].filter(Boolean).join(' ')}`;
}

/** The schedule fields a visit on `date` at `odometer` writes, unless the item has a later record. */
export function afterVisit(item: Schedule, date: Ymd, odometer: number | undefined): Pick<ServiceItemData, 'lastDate' | 'lastOdometer'> | null {
  const next = afterUsage({ lastDate: item.lastDate, lastReading: item.lastOdometer }, date, odometer);
  if (!next) return null;
  return { lastDate: next.lastDate, ...('lastReading' in next ? { lastOdometer: next.lastReading } : {}) };
}

/** The usual schedule a new car starts with; distances in miles, converted by the caller. */
export const DEFAULT_SCHEDULE: { name: string; everyMonths?: number; everyMiles?: number }[] = [
  { name: 'Oil change', everyMonths: 6, everyMiles: 5000 },
  { name: 'Tire rotation', everyMonths: 6, everyMiles: 6000 },
  { name: 'Inspection', everyMonths: 12 },
  { name: 'Wiper blades', everyMonths: 12 },
];
