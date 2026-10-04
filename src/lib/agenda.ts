import type { AgendaEdit, AgendaInput } from '@huishouden/pwa-kit/agenda';
import { allDayStart } from '@huishouden/pwa-kit/agenda';
import { appUrl, SUITE_ORIGIN } from '@huishouden/pwa-kit/site';
import { addDays, toYmd, type Ymd } from '@huishouden/pwa-kit/time';
import type { CarData } from './demo';
import { formatDistance, householdUnit, type DistanceUnit } from './distance';
import { t } from '../i18n';
import type { Appointment, Renewal, ServiceItem, Vehicle } from './model';
import { renewalDue } from './renewals';
import type { ServiceDue } from './schedule';
import { carOdometer, upcoming, type CarOdometer } from './upcoming';

// What Car puts on the household agenda (households/{id}/agenda, read by the portal): when each
// service item is next due, every renewal, and every shop appointment. Pure, so the live store can
// publish what a save changed and reconcile everything when the app opens.

export const AGENDA_APP = 'car';
/**
 * The app's address on the suite's one site; there are no routes, so every item links to the app
 * itself. In the browser the origin is the page's, so staging links to staging.
 */
export const APP_URL = appUrl(import.meta.env.BASE_URL ?? '/car/', '', globalThis.location?.origin ?? SUITE_ORIGIN);

/** An item without its ref: what replaceAgenda takes for one record. */
export type AgendaEntry = Omit<AgendaInput, 'ref'>;

export const serviceRef = (id: string) => `service:${id}`;

/**
 * How a change made in someone's own calendar (huishouden/calendar's Google sync) is written back,
 * as the person, so the rules still decide: admins and members, and whoever added the record (a
 * helper changes only their own). Writes only fields the rules let each collection take.
 */
const staffOr = (by: string) => ({ roles: ['admin' as const, 'member' as const], ...(by ? { emails: [by] } : {}) });

/** A service item: only its name. Its due day follows the schedule and the odometer, not a date to move. */
export function serviceEdit(item: Pick<ServiceItem, 'id' | 'by'>): AgendaEdit {
  return { rename: { ops: [{ col: 'carServiceItems', id: item.id, data: { name: '$title', updatedAt: '$now' }, merge: true }], ...staffOr(item.by) } };
}

/** A renewal: its due date (anyone may tick a renewal's date, as in the app), name and notes. */
export function renewalEdit(renewal: Pick<Renewal, 'id' | 'by'>): AgendaEdit {
  return {
    reschedule: { ops: [{ col: 'carRenewals', id: renewal.id, data: { dueDate: '$date', updatedAt: '$now' }, merge: true }], roles: ['admin', 'member', 'helper'] },
    rename: { ops: [{ col: 'carRenewals', id: renewal.id, data: { name: '$title', updatedAt: '$now' }, merge: true }], ...staffOr(renewal.by) },
    notes: { ops: [{ col: 'carRenewals', id: renewal.id, data: { notes: '$notes', updatedAt: '$now' }, merge: true }], ...staffOr(renewal.by) },
  };
}

/** An appointment: moved, renamed, its notes, or cancelled (deleted, as in the app). */
export function appointmentEdit(appointment: Pick<Appointment, 'id' | 'by'>): AgendaEdit {
  const write = (data: object) => [{ col: 'carAppointments', id: appointment.id, data: { ...data, updatedAt: '$now' }, merge: true }];
  return {
    reschedule: { ops: write({ at: '$start' }), ...staffOr(appointment.by) },
    rename: { ops: write({ title: '$title' }), ...staffOr(appointment.by) },
    notes: { ops: write({ notes: '$notes' }), ...staffOr(appointment.by) },
    cancel: { ops: [{ col: 'carAppointments', id: appointment.id, data: null }], ...staffOr(appointment.by) },
  };
}
export const renewalRef = (id: string) => `renewal:${id}`;
export const appointmentRef = (id: string) => `appointment:${id}`;

/**
 * The day a service item is next due, by whichever comes first: its date, or the day the car
 * reaches (or reached) its mileage at the recent pace. Items with no record, and mileage-only items
 * the app can't estimate a day for, have none.
 */
export function serviceAgenda(item: ServiceItem, vehicle: Vehicle, due: ServiceDue, odo: CarOdometer, unit: DistanceUnit, now: number, appUrl = APP_URL): AgendaEntry[] {
  if (due.state === 'unknown') return [];
  const today = toYmd(now);
  const at = due.dueAt !== null ? formatDistance(due.dueAt, unit) : null;
  let day: Ymd | null = due.dueDate;
  let detail = at ? t('agenda.orAt', { distance: at }) : undefined;
  // Mileage passed (or reached) on the latest reading's day; otherwise the estimate from the pace.
  const byDistance =
    due.distanceLeft !== null && due.distanceLeft <= 0 && odo.latest ? odo.latest.date : due.distanceDays !== null ? addDays(today, due.distanceDays) : null;
  if (byDistance && at && (day === null || byDistance < day)) {
    day = byDistance;
    detail = due.distanceLeft !== null && due.distanceLeft <= 0 ? t('agenda.dueAt', { distance: at }) : t('agenda.atEstimated', { distance: at });
  }
  if (!day) return [];
  return [
    {
      kind: 'due',
      title: item.name,
      start: allDayStart(day),
      allDay: true,
      ...(detail ? { detail } : {}),
      url: appUrl,
      who: vehicle.name,
      status: due.state === 'overdue' || day < today ? 'overdue' : 'upcoming',
      edit: serviceEdit(item),
    },
  ];
}

/** A renewal on its due date; `who` is the car, left out when it covers every car. */
export function renewalAgenda(renewal: Renewal, vehicle: Vehicle | null, now: number, appUrl = APP_URL): AgendaEntry[] {
  return [
    {
      kind: 'renewal',
      title: renewal.name,
      start: allDayStart(renewal.dueDate),
      allDay: true,
      url: appUrl,
      ...(vehicle ? { who: vehicle.name } : {}),
      status: renewalDue(renewal, now).days < 0 ? 'overdue' : 'upcoming',
      edit: renewalEdit(renewal),
    },
  ];
}

/** An appointment at its time, with the shop's name (or the address when no shop is chosen). */
export function appointmentAgenda(appointment: Appointment, data: Pick<CarData, 'vehicles' | 'contacts'>, appUrl = APP_URL): AgendaEntry[] {
  const vehicle = appointment.vehicleId ? data.vehicles.find((v) => v.id === appointment.vehicleId) : undefined;
  if (appointment.vehicleId && !vehicle) return [];
  const shop = appointment.shopId ? data.contacts.find((c) => c.id === appointment.shopId)?.name : undefined;
  const detail = shop ?? appointment.location;
  return [
    {
      kind: 'appointment',
      title: appointment.title,
      start: appointment.at,
      allDay: false,
      ...(detail ? { detail } : {}),
      url: appUrl,
      ...(vehicle ? { who: vehicle.name } : {}),
      // A private appointment stays private on the household agenda.
      ...(appointment.private ? { private: true } : {}),
      edit: appointmentEdit(appointment),
    },
  ];
}

/** Every record's items by ref. Records of a deleted car have none. */
export function agendaByRef(data: CarData, now: number, appUrl = APP_URL): Map<string, AgendaEntry[]> {
  const unit = householdUnit(data);
  const out = new Map<string, AgendaEntry[]>();
  const odometers = new Map<string, CarOdometer>();
  const odometer = (vehicleId: string) => {
    let odo = odometers.get(vehicleId);
    if (!odo) odometers.set(vehicleId, (odo = carOdometer(vehicleId, data.readings, data.serviceLog, data.serviceItems)));
    return odo;
  };
  for (const entry of upcoming(data, unit, now)) {
    if (entry.kind === 'service') out.set(serviceRef(entry.id), serviceAgenda(entry.item, entry.vehicle!, entry.due, odometer(entry.item.vehicleId), unit, now, appUrl));
    else out.set(renewalRef(entry.id), renewalAgenda(entry.renewal, entry.vehicle, now, appUrl));
  }
  for (const a of data.appointments) out.set(appointmentRef(a.id), appointmentAgenda(a, data, appUrl));
  return out;
}

/** Everything Car publishes, for syncAgenda when the app opens (the kit keeps the window), in the page's language: wrap in `localizeAgenda`. */
export function agendaItems(data: CarData, now: number, appUrl = APP_URL): AgendaInput[] {
  return [...agendaByRef(data, now, appUrl)].flatMap(([ref, items]) => items.map((i) => ({ ...i, ref })));
}

/** A record a write touched, by collection. */
export interface Touched {
  col: string;
  id: string;
}

const REFS: Record<string, (id: string) => string> = {
  carServiceItems: serviceRef,
  carRenewals: renewalRef,
  carAppointments: appointmentRef,
};

export interface AgendaChanges {
  /** Refs to make exactly these items (an empty list clears them). */
  replace: { ref: string; items: AgendaEntry[] }[];
  /** Refs whose record is gone. */
  remove: string[];
}

/**
 * What one write changes on the agenda: the records it saved or deleted, and any other record whose
 * items moved with it (a car renamed, an odometer reading that moves a mileage estimate).
 */
export function agendaChanges(before: CarData, after: CarData, touched: Touched[], now: number, appUrl = APP_URL): AgendaChanges {
  const was = agendaByRef(before, now, appUrl);
  const is = agendaByRef(after, now, appUrl);
  const exists = new Set([
    ...after.serviceItems.map((x) => serviceRef(x.id)),
    ...after.renewals.map((x) => renewalRef(x.id)),
    ...after.appointments.map((x) => appointmentRef(x.id)),
  ]);
  const refs = new Set<string>();
  for (const t of touched) if (REFS[t.col]) refs.add(REFS[t.col](t.id));
  for (const ref of new Set([...was.keys(), ...is.keys()])) if (JSON.stringify(was.get(ref) ?? []) !== JSON.stringify(is.get(ref) ?? [])) refs.add(ref);
  const changes: AgendaChanges = { replace: [], remove: [] };
  for (const ref of [...refs].sort()) {
    if (exists.has(ref)) changes.replace.push({ ref, items: is.get(ref) ?? [] });
    else changes.remove.push(ref);
  }
  return changes;
}
