import type { TodoAction, TodoInput } from '@huishouden/pwa-kit/todos';
import type { Role } from '@huishouden/pwa-kit/roles';
import type { Op } from '@huishouden/pwa-kit/store';
import { describeMonths } from '@huishouden/pwa-kit/schedule';
import { allDayStart } from '@huishouden/pwa-kit/agenda';
import { APP_URL, renewalRef, serviceAgenda, serviceRef } from './agenda';
import type { CarData } from './demo';
import { RENEWAL_LABELS, type Renewal, type ServiceItem } from './model';
import { nextRenewalDate } from './renewals';
import { carOdometer, upcoming } from './upcoming';

// What Car puts on the household to-do list (households/{id}/todos, read by the portal): the
// service items and renewals that need doing now, the same ones the Overview counts as "things
// need doing soon". Each carries the writes Car itself makes for Done / Renewed, and for Pause /
// Mark handled, so the portal can run them without knowing Car's data.

export const TODO_APP = 'car';

const ALL: Role[] = ['admin', 'member', 'helper', 'kid'];
const STAFF: Role[] = ['admin', 'member'];

/** The id of the visit a to-do's Done logs: one per item and last record, so a re-run can't log two. */
export const todoVisitId = (item: Pick<ServiceItem, 'id' | 'lastDate'>) => `todo-${item.id}-${item.lastDate ?? 'never'}`;

/**
 * Done on a service item: what logging a visit from its Done button saves when the form is accepted
 * as offered: a visit today at the car's latest known odometer reading, moving the item forward.
 * Helpers and kids may: they log visits in their own name and tick anyone's item (lastDate,
 * lastOdometer and updatedAt are the rules' ticks).
 */
export function serviceDone(item: ServiceItem, odometer: number | undefined): TodoAction {
  const known = odometer !== undefined ? { odometer } : {};
  const ops: Op[] = [
    {
      col: 'carServiceLog',
      id: todoVisitId(item),
      data: { vehicleId: item.vehicleId, date: '$today', ...known, what: item.name, serviceItemIds: [item.id], createdAt: '$now', by: '$me' },
    },
    {
      col: 'carServiceItems',
      id: item.id,
      data: { lastDate: '$today', ...(odometer !== undefined ? { lastOdometer: odometer } : {}), updatedAt: '$now' },
      merge: true,
    },
  ];
  return { label: 'Done', ops, roles: ALL };
}

/** Pause: it stops coming due until someone resumes it in Car. Admins, members and whoever added it. */
export const servicePause = (item: ServiceItem): TodoAction => ({
  label: 'Pause',
  ops: [{ col: 'carServiceItems', id: item.id, data: { pausedAt: '$now', updatedAt: '$now' }, merge: true }],
  roles: STAFF,
  owner: true,
});

/**
 * Renewed: a repeating renewal moves to its next due date, counted from the due date (the
 * anniversary stays put), as Car's own Renewed button; anyone may (dueDate is a tick). One that
 * doesn't repeat is closed, which is the owner's or staff's to do.
 */
export function renewalDone(renewal: Renewal, now: number): TodoAction {
  const next = nextRenewalDate(renewal, now);
  if (next) return { label: 'Renewed', ops: [{ col: 'carRenewals', id: renewal.id, data: { dueDate: next, updatedAt: '$now' }, merge: true }], roles: ALL };
  return { label: 'Renewed', ops: [{ col: 'carRenewals', id: renewal.id, data: { closedAt: '$now', updatedAt: '$now' }, merge: true }], roles: STAFF, owner: true };
}

/** Mark handled: closed without renewing (sold the car, moved the policy). */
export const renewalClose = (renewal: Renewal): TodoAction => ({
  label: 'Mark handled',
  ops: [{ col: 'carRenewals', id: renewal.id, data: { closedAt: '$now', updatedAt: '$now' }, merge: true }],
  roles: STAFF,
  owner: true,
});

/** "Renew registration", "Renew inspection sticker", "Renew E-ZPass": a kind's own name reads lower-case. */
export function renewalTitle(name: string): string {
  const plain = Object.values(RENEWAL_LABELS).some((l) => l.toLowerCase() === name.trim().toLowerCase());
  return `Renew ${plain ? name.trim().toLowerCase() : name.trim()}`;
}

/** Everything Car publishes to the to-do list: overdue and soon service items and renewals. */
export function todoItems(data: CarData, now: number, appUrl = APP_URL): TodoInput[] {
  const unit = data.settings?.distanceUnit ?? 'mi';
  const out: TodoInput[] = [];
  for (const entry of upcoming(data, unit, now)) {
    if (entry.state !== 'overdue' && entry.state !== 'soon') continue;
    if (entry.kind === 'service') {
      const { item } = entry;
      const odo = carOdometer(item.vehicleId, data.readings, data.serviceLog, data.serviceItems);
      const [agenda] = serviceAgenda(item, entry.vehicle!, entry.due, odo, unit, now, appUrl);
      out.push({
        ref: serviceRef(item.id),
        title: item.name,
        ...(agenda?.detail ? { detail: agenda.detail } : {}),
        createdAt: item.createdAt,
        ...(agenda ? { due: agenda.start } : {}),
        who: entry.vehicle!.name,
        url: appUrl,
        owner: item.by,
        done: serviceDone(item, odo.latest?.reading),
        cancel: servicePause(item),
      });
    } else {
      const { renewal } = entry;
      out.push({
        ref: renewalRef(renewal.id),
        title: renewalTitle(renewal.name),
        detail: describeMonths(renewal.everyMonths),
        createdAt: renewal.createdAt,
        due: allDayStart(renewal.dueDate),
        ...(entry.vehicle ? { who: entry.vehicle.name } : {}),
        url: appUrl,
        owner: renewal.by,
        done: renewalDone(renewal, now),
        cancel: renewalClose(renewal),
      });
    }
  }
  return out;
}
