import { getHome, householdTimeZone } from '@huishouden/pwa-kit/home';
import { zonedTime } from '@huishouden/pwa-kit/ics';
import { reminderId, type ReminderInput, type ReminderSource } from '@huishouden/pwa-kit/reminders';
import { appUrl, SUITE_ORIGIN } from '@huishouden/pwa-kit/site';
import { addDays, type Ymd } from '@huishouden/pwa-kit/time';
import { t } from '../i18n';
import { AGENDA_APP } from './agenda';
import type { Renewal, ServiceItem, Vehicle } from './model';
import { serviceDue } from './schedule';

// What Car asks the shared sender (huishouden/notify) to push: for each renewal and each
// service item that repeats by time, one notification a week before it is due and one on the day.

/** When reminders go out, on the household's clock. */
export const REMIND_TIME = '09:00';
/** Days before the due day that the early reminder goes out. */
export const REMIND_DAYS_BEFORE = 7;

export const renewalReminderRef = (id: string) => `${AGENDA_APP}:renewal:${id}`;
export const serviceReminderRef = (id: string) => `${AGENDA_APP}:service:${id}`;

/** Reminders are on unless the record says `remind: false`. */
export const reminds = (r: { remind?: boolean }) => r.remind !== false;

const appLink = () => appUrl(import.meta.env?.BASE_URL ?? '/car/', '', globalThis.location?.origin ?? SUITE_ORIGIN);

/**
 * What a renewal's reminders are about, for the sender to check before sending: the renewal, while
 * it is open and still due that day. Renewed (the date moves), closed or removed, they are deleted unsent.
 */
export const renewalSource = (r: Pick<Renewal, 'id' | 'dueDate'>): ReminderSource => ({
  checks: [{ doc: `carRenewals/${r.id}`, due: [{ field: 'closedAt', in: [null] }, { field: 'dueDate', in: [r.dueDate] }] }],
});

/** Likewise for a service item: until it is serviced (the last date moves), paused or removed. */
export const serviceSource = (i: Pick<ServiceItem, 'id' | 'lastDate'>): ReminderSource => ({
  checks: [{ doc: `carServiceItems/${i.id}`, due: [{ field: 'pausedAt', in: [null] }, { field: 'lastDate', in: [i.lastDate ?? null] }] }],
});

export interface ReminderData {
  vehicles: Vehicle[];
  serviceItems: ServiceItem[];
  renewals: Renewal[];
}

/**
 * Every reminder Car wants delivered, in the page's language (wrap in `localizeReminders` for every
 * language): at 9:00 on the household's clock, a week before and on the day, for each open
 * renewal and each unpaused service item with a time-based due day (distance-only items have none:
 * the odometer isn't known ahead). Items with `remind: false`, past times and records of deleted
 * cars are left out, so writing the list again cancels theirs. All members get them.
 */
export function carReminders(data: ReminderData, now: number, zone = householdTimeZone(getHome())): ReminderInput[] {
  const cars = new Map(data.vehicles.map((v) => [v.id, v]));
  const url = appLink();
  const out: ReminderInput[] = [];
  const add = (ref: string, due: Ymd, name: string, body: string, source: ReminderSource) => {
    const early = zonedTime(addDays(due, -REMIND_DAYS_BEFORE), REMIND_TIME, zone);
    const day = zonedTime(due, REMIND_TIME, zone);
    const base = { app: AGENDA_APP, body, url, recipients: 'all' as const, ref, private: false, source };
    for (const [at, title] of [
      [early, t('remind.inWeek', { name })],
      [day, t('remind.today', { name })],
    ] as const)
      if (at > now) out.push({ ...base, id: reminderId(ref, at), title, at });
  };
  for (const r of data.renewals) {
    const car = r.vehicleId ? cars.get(r.vehicleId) : undefined;
    if (r.closedAt || !reminds(r) || (r.vehicleId && !car)) continue;
    add(renewalReminderRef(r.id), r.dueDate, r.name, car?.name ?? '', renewalSource(r));
  }
  for (const i of data.serviceItems) {
    const car = cars.get(i.vehicleId);
    if (!car || i.pausedAt || !reminds(i)) continue;
    const due = serviceDue(i, null, null, now).dueDate;
    if (due) add(serviceReminderRef(i.id), due, i.name, car.name, serviceSource(i));
  }
  return out.sort((a, b) => a.at - b.at || a.id!.localeCompare(b.id!));
}
