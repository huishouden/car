import type { Contact, ContactInput } from '@huishouden/pwa-kit/contacts';
import type { DistanceUnit } from '../lib/distance';
import { defaultDistance } from '../lib/distance';
import type { CarData } from '../lib/demo';
import { nextRenewalDate } from '../lib/renewals';
import { DEFAULT_SCHEDULE, afterVisit } from '../lib/schedule';
import { appointmentDoc, readingDoc, renewalDoc, serviceItemDoc, vehicleDoc, visitDoc } from './build';
import type { CarActions, Undo } from './types';

// The car actions, written once over a small storage interface that the live (Firestore) and the
// demo (memory) stores each implement. Every change returns an Undo that writes back exactly the
// documents it touched, under the same ids.

export const COLLECTIONS = {
  carVehicles: 'vehicles',
  carServiceItems: 'serviceItems',
  carOdometer: 'readings',
  carRenewals: 'renewals',
  carServiceLog: 'serviceLog',
  carAppointments: 'appointments',
} as const satisfies Record<string, keyof CarData>;
export type CollectionName = keyof typeof COLLECTIONS;

export type Op = { type: 'set'; col: CollectionName; id: string; data: object } | { type: 'delete'; col: CollectionName; id: string };

export interface Backend {
  newId(col: CollectionName): string;
  /** Applies the operations together (one batch). */
  write(ops: Op[]): void;
  saveSettings(unit: DistanceUnit, by: string, now: number): void;
  saveContact(id: string | null, input: ContactInput): void;
  deleteContact(contact: Contact): void;
  restoreContact(contact: Contact): void;
}

const withoutId = <T extends { id: string }>({ id: _id, ...rest }: T) => rest;

export function createActions(backend: Backend, data: () => CarData, me: string, clock: () => number): CarActions {
  const find = (col: CollectionName, id: string) => (data()[COLLECTIONS[col]] as { id: string }[]).find((d) => d.id === id);

  /** Writes the ops and returns the inverse: the previous version of each document, or its removal. */
  const change = (ops: Op[]): Undo => {
    const inverse: Op[] = [];
    const seen = new Set<string>();
    for (const op of ops) {
      const key = `${op.col}/${op.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const before = find(op.col, op.id);
      inverse.push(before ? { type: 'set', col: op.col, id: op.id, data: withoutId(before) } : { type: 'delete', col: op.col, id: op.id });
    }
    backend.write(ops);
    return () => backend.write(inverse.reverse());
  };

  const stampFor = (col: CollectionName, id: string | null) => {
    const existing = id ? (find(col, id) as { createdAt: number; by: string } | undefined) : undefined;
    const now = clock();
    return existing ? { createdAt: existing.createdAt, by: existing.by, updatedAt: now } : { createdAt: now, by: me };
  };

  const save = <I>(col: CollectionName, build: (input: I, s: ReturnType<typeof stampFor>) => object) => (id: string | null, input: I): Undo => {
    const docId = id ?? backend.newId(col);
    return change([{ type: 'set', col, id: docId, data: build(input, stampFor(col, id)) }]);
  };
  const remove = (col: CollectionName) => (id: string): Undo => change([{ type: 'delete', col, id }]);

  return {
    setDistanceUnit: (unit) => backend.saveSettings(unit, me, clock()),

    saveVehicle: (id, input, options = {}) => {
      const vehicleId = id ?? backend.newId('carVehicles');
      const ops: Op[] = [{ type: 'set', col: 'carVehicles', id: vehicleId, data: vehicleDoc(input, stampFor('carVehicles', id)) }];
      if (!id && options.defaultSchedule) {
        const unit = data().settings?.distanceUnit ?? 'mi';
        for (const d of DEFAULT_SCHEDULE) {
          const item = { vehicleId, name: d.name, everyMonths: d.everyMonths, everyDistance: d.everyMiles ? defaultDistance(d.everyMiles, unit) : undefined };
          ops.push({ type: 'set', col: 'carServiceItems', id: backend.newId('carServiceItems'), data: serviceItemDoc(item, stampFor('carServiceItems', null)) });
        }
      }
      return { id: vehicleId, undo: change(ops) };
    },

    deleteVehicle: (id) => {
      const d = data();
      const ops: Op[] = [{ type: 'delete', col: 'carVehicles', id }];
      const owned = (col: CollectionName) =>
        (d[COLLECTIONS[col]] as { id: string; vehicleId?: string }[]).filter((x) => x.vehicleId === id).forEach((x) => ops.push({ type: 'delete', col, id: x.id }));
      owned('carServiceItems');
      owned('carOdometer');
      owned('carRenewals');
      owned('carServiceLog');
      owned('carAppointments');
      return change(ops);
    },

    saveServiceItem: save('carServiceItems', serviceItemDoc),
    deleteServiceItem: remove('carServiceItems'),

    logReading: (input) => save('carOdometer', readingDoc)(null, input),
    deleteReading: remove('carOdometer'),

    saveRenewal: save('carRenewals', renewalDoc),
    markRenewed: (id) => {
      const r = data().renewals.find((x) => x.id === id);
      const next = r && nextRenewalDate(r, clock());
      if (!r || !next) return () => {};
      return change([{ type: 'set', col: 'carRenewals', id, data: renewalDoc({ ...withoutId(r), dueDate: next }, stampFor('carRenewals', id)) }]);
    },
    deleteRenewal: remove('carRenewals'),

    saveVisit: (id, input) => {
      const visitId = id ?? backend.newId('carServiceLog');
      const doc = visitDoc(input, stampFor('carServiceLog', id));
      const ops: Op[] = [{ type: 'set', col: 'carServiceLog', id: visitId, data: doc }];
      for (const itemId of doc.serviceItemIds ?? []) {
        const item = data().serviceItems.find((i) => i.id === itemId && i.vehicleId === doc.vehicleId);
        const fields = item && afterVisit(item, doc.date, doc.odometer);
        if (item && fields) {
          const { lastDate: _d, lastOdometer: _o, ...rest } = withoutId(item);
          ops.push({ type: 'set', col: 'carServiceItems', id: item.id, data: serviceItemDoc({ ...rest, ...fields }, stampFor('carServiceItems', item.id)) });
        }
      }
      return change(ops);
    },
    deleteVisit: remove('carServiceLog'),

    saveAppointment: save('carAppointments', appointmentDoc),
    deleteAppointment: remove('carAppointments'),

    saveContact: (id, input) => backend.saveContact(id, input),
    deleteContact: (id) => {
      const c = data().contacts.find((x) => x.id === id);
      if (c) backend.deleteContact(c);
    },
    restoreContact: (c) => backend.restoreContact(c),
  };
}
