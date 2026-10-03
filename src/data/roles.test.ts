import { describe, expect, test } from 'bun:test';
import { DEMO_NOW, demoData, type CarData } from '../lib/demo';
import { appointmentAgenda } from '../lib/agenda';
import { mayFor } from '../lib/may';
import { applyOps, createActions, type Backend, type Op } from './actions';
import { appointmentDoc } from './build';

// What a helper's device writes must fit the rules: on someone else's record, only the fields that
// tick it off (huishouden/rules README "Roles").
const HELPER = 'helper@example.com';

function setup(me: string) {
  let data: CarData = demoData();
  const writes: Op[][] = [];
  let seq = 0;
  const backend: Backend = {
    newId: (col) => `${col}-${seq++}`,
    write: (ops) => {
      writes.push(ops);
      data = applyOps(data, ops);
    },
    saveSettings: () => {},
    contacts: { save: () => {}, remove: () => {}, restore: () => {} },
  };
  return { actions: createActions(backend, () => data, me, () => DEMO_NOW), writes, get: () => data };
}

const changed = (before: object, after: object) =>
  [...new Set([...Object.keys(before), ...Object.keys(after)])].filter((k) => JSON.stringify((before as Record<string, unknown>)[k]) !== JSON.stringify((after as Record<string, unknown>)[k])).sort();

describe('a helper ticking off someone else’s records', () => {
  test('a visit moves the service item forward, touching only its last service and time, and is signed by the helper', () => {
    const { actions, writes, get } = setup(HELPER);
    const { id: _id, ...before } = get().serviceItems.find((i) => i.id === 'demo-item-van-oil')!;
    actions.saveVisit(null, { vehicleId: 'demo-car-van', date: '2031-04-15', odometer: 41450, what: 'Oil change', serviceItemIds: ['demo-item-van-oil'] });
    const [visit, item] = writes.at(-1)! as (Op & { data: object })[];
    expect((visit.data as { by: string }).by).toBe(HELPER);
    expect(changed(before, item.data)).toEqual(['lastDate', 'lastOdometer', 'updatedAt']);
  });

  test('marking a renewal renewed changes only its due date and time', () => {
    const { actions, writes, get } = setup(HELPER);
    const renewal = get().renewals.find((r) => r.everyMonths)!;
    const { id: _id, ...before } = renewal;
    actions.markRenewed(renewal.id);
    expect(changed(before, (writes.at(-1)![0] as Op & { data: object }).data)).toEqual(['dueDate', 'updatedAt']);
  });
});

describe('private appointments', () => {
  const stamp = { createdAt: 1, by: 'alex@example.com' };
  test('every appointment is written with the flag', () => {
    expect(appointmentDoc({ title: 'Oil change', at: DEMO_NOW }, stamp).private).toBe(false);
    expect(appointmentDoc({ title: 'Body shop quote', at: DEMO_NOW, private: true }, stamp).private).toBe(true);
  });

  test('a private appointment stays private on the household agenda', () => {
    const data = demoData();
    const a = { id: 'a1', ...appointmentDoc({ title: 'Body shop quote', at: DEMO_NOW, private: true }, stamp) };
    expect(appointmentAgenda(a, data)[0].private).toBe(true);
    expect(appointmentAgenda({ ...a, private: false }, data)[0].private).toBeUndefined();
  });
});

describe('what each role may do', () => {
  test('admins and members change anything; helpers and kids only what they added, and no cars or settings', () => {
    const mine = { by: HELPER };
    const theirs = { by: 'alex@example.com' };
    for (const role of ['admin', 'member'] as const) {
      const may = mayFor({ role, me: 'sam@example.com' });
      expect([may.settings, may.seePrivate, may.change(theirs)]).toEqual([true, true, true]);
    }
    for (const role of ['helper', 'kid'] as const) {
      const may = mayFor({ role, me: HELPER });
      expect([may.settings, may.seePrivate, may.change(theirs), may.change(mine), may.change({})]).toEqual([false, false, false, true, false]);
    }
  });
});
