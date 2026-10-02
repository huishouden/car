import type { AppointmentData, OdometerData, RenewalData, ServiceItemData, ServiceLogData, VehicleData } from '../lib/model';
import { LIMITS, RENEWAL_KINDS } from '../lib/model';
import { isYmd } from '../lib/time';
import type { AppointmentInput, ReadingInput, RenewalInput, ServiceItemInput, VehicleInput, VisitInput } from './types';

// Builds documents with exactly the keys and limits the rules accept; shared by the live and demo
// stores. Optional fields are left out rather than written empty.

interface Stamp {
  createdAt: number;
  updatedAt?: number;
  by: string;
}

const text = (s: string | undefined, max: number) => {
  const t = s?.trim();
  return t ? t.slice(0, max) : undefined;
};
const whole = (n: number | undefined, min: number, max: number) => (n !== undefined && Number.isFinite(n) && n >= min && n <= max ? Math.round(n) : undefined);
const ymd = (s: string | undefined) => (isYmd(s) ? s : undefined);

/** Drops undefined values: Firestore rejects them and the rules count every key. */
function compact<T extends object>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
}

const stamp = (s: Stamp): Stamp => compact({ createdAt: Math.round(s.createdAt), updatedAt: s.updatedAt === undefined ? undefined : Math.round(s.updatedAt), by: s.by });

export function vehicleDoc(v: VehicleInput, s: Stamp): VehicleData {
  return compact({
    name: v.name.trim().slice(0, LIMITS.vehicleName),
    make: text(v.make, LIMITS.make),
    model: text(v.model, LIMITS.model),
    year: whole(v.year, LIMITS.minYear, LIMITS.maxYear),
    notes: text(v.notes, LIMITS.vehicleNotes),
    ...stamp(s),
  });
}

export function serviceItemDoc(i: ServiceItemInput, s: Stamp): ServiceItemData {
  return compact({
    vehicleId: i.vehicleId,
    name: i.name.trim().slice(0, LIMITS.itemName),
    everyMonths: whole(i.everyMonths, 1, LIMITS.maxEveryMonths),
    everyDistance: whole(i.everyDistance, 1, LIMITS.maxEveryDistance),
    lastDate: ymd(i.lastDate),
    lastOdometer: whole(i.lastOdometer, 0, LIMITS.maxReading),
    notes: text(i.notes, LIMITS.itemNotes),
    ...stamp(s),
  });
}

export function readingDoc(r: ReadingInput, s: Stamp): OdometerData {
  return compact({
    vehicleId: r.vehicleId,
    date: r.date,
    reading: Math.round(r.reading),
    note: text(r.note, LIMITS.readingNote),
    ...stamp(s),
  });
}

export function renewalDoc(r: RenewalInput, s: Stamp): RenewalData {
  return compact({
    vehicleId: r.vehicleId || undefined,
    kind: RENEWAL_KINDS.includes(r.kind) ? r.kind : 'other',
    name: r.name.trim().slice(0, LIMITS.renewalName),
    dueDate: r.dueDate,
    everyMonths: whole(r.everyMonths, 1, LIMITS.maxRenewalMonths),
    notes: text(r.notes, LIMITS.renewalNotes),
    ...stamp(s),
  });
}

export function visitDoc(v: VisitInput, s: Stamp): ServiceLogData {
  const ids = v.serviceItemIds?.filter(Boolean).slice(0, 20);
  return compact({
    vehicleId: v.vehicleId,
    date: v.date,
    odometer: whole(v.odometer, 0, LIMITS.maxReading),
    what: v.what.trim().slice(0, LIMITS.what),
    serviceItemIds: ids?.length ? ids : undefined,
    shopId: v.shopId || undefined,
    costCents: whole(v.costCents, 0, LIMITS.maxCostCents),
    notes: text(v.notes, LIMITS.logNotes),
    ...stamp(s),
  });
}

export function appointmentDoc(a: AppointmentInput, s: Stamp): AppointmentData {
  return compact({
    vehicleId: a.vehicleId || undefined,
    title: a.title.trim().slice(0, LIMITS.title),
    at: Math.round(a.at),
    location: text(a.location, LIMITS.location),
    notes: text(a.notes, LIMITS.appointmentNotes),
    shopId: a.shopId || undefined,
    calendarEventId: a.calendarEventId || undefined,
    calendarLink: a.calendarLink && /^https:\/\//.test(a.calendarLink) ? a.calendarLink : undefined,
    ...stamp(s),
  });
}
