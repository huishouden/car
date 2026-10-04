import type { ContactWrites } from '@huishouden/pwa-kit/contacts';
import { applyOps as applyKitOps, changes, stampFor, withoutId, type Backend as KitBackend, type Op as KitOp } from '@huishouden/pwa-kit/store';
import type { DistanceUnit } from '../lib/distance';
import { defaultDistance, householdUnit } from '../lib/distance';
import type { CarData } from '../lib/demo';
import { nextRenewalDate } from '../lib/renewals';
import { afterVisit, defaultSchedule } from '../lib/schedule';
import { appointmentDoc, readingDoc, renewalDoc, serviceItemDoc, vehicleDoc, visitDoc } from './build';
import type { CarActions } from './types';
import { track } from '@huishouden/pwa-kit/observability';

// The car actions, written once over a small storage interface that the live (Firestore) and the
// demo (memory) stores each implement (@huishouden/pwa-kit/store). Every change returns an Undo
// that writes back exactly the documents it touched, under the same ids.

/** Firestore collection names under households/{id}, and the data key that holds each. */
export const COLLECTIONS = {
  carVehicles: 'vehicles',
  carServiceItems: 'serviceItems',
  carOdometer: 'readings',
  carRenewals: 'renewals',
  carServiceLog: 'serviceLog',
  carAppointments: 'appointments',
} as const satisfies Record<string, keyof CarData>;
export type CollectionName = keyof typeof COLLECTIONS;

export type Op = KitOp<CollectionName>;

export interface Backend extends KitBackend<CollectionName> {
  saveSettings(unit: DistanceUnit, by: string, now: number): void;
  contacts: ContactWrites;
}

/** `data` with the operations applied, as the stores hold it once a write lands. */
export const applyOps = (data: CarData, ops: Op[]): CarData => applyKitOps(data, ops, (col) => COLLECTIONS[col]);

export function createActions(backend: Backend, data: () => CarData, me: string, clock: () => number): CarActions {
  const find = (col: CollectionName, id: string) => (data()[COLLECTIONS[col]] as { id: string }[]).find((d) => d.id === id);

  const change = changes(backend, find);
  const stamp = (col: CollectionName, id: string | null) => stampFor(id ? (find(col, id) as { createdAt: number; by: string } | undefined) : undefined, me, clock());

  const save = <I>(col: CollectionName, build: (input: I, s: ReturnType<typeof stamp>) => object) => (id: string | null, input: I) => {
    const docId = id ?? backend.newId(col);
    return change([{ col, id: docId, data: build(input, stamp(col, id)) }]);
  };
  const remove = (col: CollectionName) => (id: string) => change([{ col, id, data: null }]);

  /** Pauses or resumes a service item (`pausedAt`): the whole record, rebuilt. */
  const setPaused = (id: string, pausedAt: number | undefined) => {
    const item = data().serviceItems.find((i) => i.id === id);
    if (!item) return () => {};
    return change([{ col: 'carServiceItems', id, data: serviceItemDoc({ ...withoutId(item), pausedAt }, stamp('carServiceItems', id)) }]);
  };
  /** Closes or reopens a renewal (`closedAt`). */
  const setClosed = (id: string, closedAt: number | undefined) => {
    const r = data().renewals.find((x) => x.id === id);
    if (!r) return () => {};
    return change([{ col: 'carRenewals', id, data: renewalDoc({ ...withoutId(r), closedAt }, stamp('carRenewals', id)) }]);
  };

  return {
    setDistanceUnit: (unit) => backend.saveSettings(unit, me, clock()),

    saveVehicle: (id, input, options = {}) => {

      track('save vehicle');
      const vehicleId = id ?? backend.newId('carVehicles');
      const ops: Op[] = [{ col: 'carVehicles', id: vehicleId, data: vehicleDoc(input, stamp('carVehicles', id)) }];
      const unit = householdUnit(data());
      // The household's first car fixes the unit for every member, whatever their phones' regions.
      if (!data().settings) backend.saveSettings(unit, me, clock());
      if (!id && options.defaultSchedule) {
        for (const d of defaultSchedule()) {
          const item = { vehicleId, name: d.name, everyMonths: d.everyMonths, everyDistance: d.everyMiles ? defaultDistance(d.everyMiles, unit) : undefined };
          ops.push({ col: 'carServiceItems', id: backend.newId('carServiceItems'), data: serviceItemDoc(item, stamp('carServiceItems', null)) });
        }
      }
      return { id: vehicleId, undo: change(ops) };
    },

    deleteVehicle: (id) => {
      const d = data();
      const ops: Op[] = [{ col: 'carVehicles', id, data: null }];
      const owned = (col: CollectionName) =>
        (d[COLLECTIONS[col]] as { id: string; vehicleId?: string }[]).filter((x) => x.vehicleId === id).forEach((x) => ops.push({ col, id: x.id, data: null }));
      owned('carServiceItems');
      owned('carOdometer');
      owned('carRenewals');
      owned('carServiceLog');
      owned('carAppointments');
      return change(ops);
    },

    // An edit keeps the item paused (and a renewal closed): the dialogs don't carry those.
    saveServiceItem: (id, input) => save('carServiceItems', serviceItemDoc)(id, { pausedAt: id ? data().serviceItems.find((i) => i.id === id)?.pausedAt : undefined, ...input }),
    deleteServiceItem: remove('carServiceItems'),
    pauseServiceItem: (id) => setPaused(id, clock()),
    resumeServiceItem: (id) => setPaused(id, undefined),

    logReading: (input) => {
      track('log odometer');
      return save('carOdometer', readingDoc)(null, input);
    },
    deleteReading: remove('carOdometer'),

    saveRenewal: (id, input) => save('carRenewals', renewalDoc)(id, { closedAt: id ? data().renewals.find((r) => r.id === id)?.closedAt : undefined, ...input }),
    closeRenewal: (id) => setClosed(id, clock()),
    reopenRenewal: (id) => setClosed(id, undefined),
    markRenewed: (id) => {
      track('mark renewed');
      const r = data().renewals.find((x) => x.id === id);
      const next = r && nextRenewalDate(r, clock());
      if (!r || !next) return () => {};
      return change([{ col: 'carRenewals', id, data: renewalDoc({ ...withoutId(r), dueDate: next }, stamp('carRenewals', id)) }]);
    },
    deleteRenewal: remove('carRenewals'),

    saveVisit: (id, input) => {

      track('log service');
      const visitId = id ?? backend.newId('carServiceLog');
      const doc = visitDoc(input, stamp('carServiceLog', id));
      const ops: Op[] = [{ col: 'carServiceLog', id: visitId, data: doc }];
      for (const itemId of doc.serviceItemIds ?? []) {
        const item = data().serviceItems.find((i) => i.id === itemId && i.vehicleId === doc.vehicleId);
        const fields = item && afterVisit(item, doc.date, doc.odometer);
        if (item && fields) {
          const { lastDate: _d, lastOdometer: _o, ...rest } = withoutId(item);
          ops.push({ col: 'carServiceItems', id: item.id, data: serviceItemDoc({ ...rest, ...fields }, stamp('carServiceItems', item.id)) });
        }
      }
      return change(ops);
    },
    deleteVisit: remove('carServiceLog'),

    saveAppointment: save('carAppointments', appointmentDoc),
    deleteAppointment: remove('carAppointments'),

    saveContact: (id, input) => backend.contacts.save(id, input),
    deleteContact: (id) => {
      const c = data().contacts.find((x) => x.id === id);
      if (c) backend.contacts.remove(c);
    },
    restoreContact: (c) => backend.contacts.restore(c),
  };
}
