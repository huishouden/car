import type { DistanceUnit } from './distance';
import type { OdometerReading, Renewal, ServiceItem, ServiceLogEntry, Vehicle } from './model';
import { dailyPace, latestReading, type MeterReading as OdometerPoint } from '@huishouden/pwa-kit/schedule';
import { renewalDue, renewalText, type RenewalState } from './renewals';
import { dueText, serviceDue, type DueState, type ServiceDue } from './schedule';

// What the household needs to do next, across every car: service items and renewals in one list.

/** Every known odometer point for one car: readings, service visits, and schedule records. */
export function odometerPoints(vehicleId: string, readings: OdometerReading[], log: ServiceLogEntry[], items: ServiceItem[]): OdometerPoint[] {
  const points: OdometerPoint[] = [];
  for (const r of readings) if (r.vehicleId === vehicleId) points.push({ date: r.date, reading: r.reading });
  for (const e of log) if (e.vehicleId === vehicleId && e.odometer !== undefined) points.push({ date: e.date, reading: e.odometer });
  for (const i of items) if (i.vehicleId === vehicleId && i.lastDate && i.lastOdometer !== undefined) points.push({ date: i.lastDate, reading: i.lastOdometer });
  return points;
}

export interface CarOdometer {
  latest: OdometerPoint | null;
  /** Distance per day over the last year, when there is enough to tell. */
  pace: number | null;
}

export function carOdometer(vehicleId: string, readings: OdometerReading[], log: ServiceLogEntry[], items: ServiceItem[]): CarOdometer {
  const points = odometerPoints(vehicleId, readings, log, items);
  return { latest: latestReading(points), pace: dailyPace(points) };
}

export type UpcomingItem =
  | { kind: 'service'; id: string; vehicle: Vehicle | null; item: ServiceItem; due: ServiceDue; state: DueState; text: string; sortDays: number }
  | { kind: 'renewal'; id: string; vehicle: Vehicle | null; renewal: Renewal; state: RenewalState; text: string; sortDays: number };

const RANK: Record<DueState, number> = { overdue: 0, soon: 1, ok: 2, unknown: 3 };

export interface UpcomingInput {
  vehicles: Vehicle[];
  serviceItems: ServiceItem[];
  readings: OdometerReading[];
  serviceLog: ServiceLogEntry[];
  renewals: Renewal[];
}

/** Every service item and renewal, overdue first, then soonest; items with no record last. */
export function upcoming(data: UpcomingInput, unit: DistanceUnit, now: number): UpcomingItem[] {
  const byId = new Map(data.vehicles.map((v) => [v.id, v]));
  const odometers = new Map(data.vehicles.map((v) => [v.id, carOdometer(v.id, data.readings, data.serviceLog, data.serviceItems)]));
  const out: UpcomingItem[] = [];
  for (const item of data.serviceItems) {
    const vehicle = byId.get(item.vehicleId);
    // A schedule left behind by a deleted car is not the household's to do any more.
    if (!vehicle) continue;
    const odo = odometers.get(item.vehicleId)!;
    const due = serviceDue(item, odo.latest, odo.pace, now);
    out.push({ kind: 'service', id: item.id, vehicle, item, due, state: due.state, text: dueText(item.name, due, unit), sortDays: due.sortDays });
  }
  for (const renewal of data.renewals) {
    const vehicle = renewal.vehicleId ? (byId.get(renewal.vehicleId) ?? null) : null;
    if (renewal.vehicleId && !vehicle) continue;
    const due = renewalDue(renewal, now);
    out.push({ kind: 'renewal', id: renewal.id, vehicle, renewal, state: due.state, text: renewalText(renewal, now), sortDays: due.days });
  }
  return out.sort((a, b) => RANK[a.state] - RANK[b.state] || a.sortDays - b.sortDays || a.text.localeCompare(b.text));
}

/** How many need attention now (overdue or within the soon window). */
export const needsAttention = (items: UpcomingItem[]) => items.filter((i) => i.state === 'overdue' || i.state === 'soon').length;
