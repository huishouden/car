import { describe, expect, test } from 'bun:test';
import { DEMO_NOW, demoData, type CarData } from '../lib/demo';
import { applyOps, createActions, type Backend, type Op } from './actions';

// The actions over a memory backend that records every write, as the live store's batches would.
function setup() {
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
  const actions = createActions(backend, () => data, 'alex@example.com', () => DEMO_NOW);
  return { actions, writes, get: () => data };
}

describe('a logged visit', () => {
  test('moves its items forward in one batch, and Undo restores both', () => {
    const { actions, writes, get } = setup();
    const before = get().serviceItems.find((i) => i.id === 'demo-item-van-oil')!;
    const undo = actions.saveVisit(null, { vehicleId: 'demo-car-van', date: '2031-04-15', odometer: 41450, what: 'Oil change', serviceItemIds: ['demo-item-van-oil'], costCents: 8999 });
    expect(writes.at(-1)!.map((o) => `${o.data ? 'set' : 'delete'} ${o.col}`)).toEqual(['set carServiceLog', 'set carServiceItems']);
    const after = get().serviceItems.find((i) => i.id === 'demo-item-van-oil')!;
    expect(after).toMatchObject({ lastDate: '2031-04-15', lastOdometer: 41450, by: before.by, createdAt: before.createdAt, updatedAt: DEMO_NOW });
    undo();
    expect(get().serviceItems.find((i) => i.id === 'demo-item-van-oil')).toEqual(before);
    expect(get().serviceLog).toHaveLength(6);
  });

  test('a visit for another car leaves this car’s items alone', () => {
    const { actions, get } = setup();
    actions.saveVisit(null, { vehicleId: 'demo-car-commuter', date: '2031-04-15', what: 'Oil change', serviceItemIds: ['demo-item-van-oil'] });
    expect(get().serviceItems.find((i) => i.id === 'demo-item-van-oil')!.lastDate).toBe('2030-11-08');
  });
});

test('deleting a car deletes what belongs to it; Undo puts every document back', () => {
  const { actions, get } = setup();
  const before = get();
  const undo = actions.deleteVehicle('demo-car-van');
  const after = get();
  expect(after.vehicles.map((v) => v.id)).toEqual(['demo-car-commuter']);
  expect(after.serviceItems.every((i) => i.vehicleId !== 'demo-car-van')).toBe(true);
  expect(after.renewals.map((r) => r.name)).toContain('Insurance');
  undo();
  for (const key of ['vehicles', 'serviceItems', 'readings', 'renewals', 'serviceLog', 'appointments'] as const) {
    const sort = (l: { id: string }[]) => [...l].sort((a, b) => a.id.localeCompare(b.id));
    expect(sort(get()[key])).toEqual(sort(before[key]));
  }
});

test('a new car with the usual schedule writes the car and four items together', () => {
  const { actions, writes, get } = setup();
  const { id, undo } = actions.saveVehicle(null, { name: 'Weekend car' }, { defaultSchedule: true });
  expect(writes.at(-1)).toHaveLength(5);
  expect(get().serviceItems.filter((i) => i.vehicleId === id).map((i) => i.name)).toEqual(['Oil change', 'Tire rotation', 'Inspection', 'Wiper blades']);
  undo();
  expect(get().vehicles.some((v) => v.id === id)).toBe(false);
  expect(get().serviceItems.some((i) => i.vehicleId === id)).toBe(false);
});

test('marking a renewal renewed keeps its creator and moves the date', () => {
  const { actions, get } = setup();
  const undo = actions.markRenewed('demo-renewal-van-registration');
  expect(get().renewals.find((r) => r.id === 'demo-renewal-van-registration')).toMatchObject({ dueDate: '2032-04-27', by: 'sam@example.com' });
  undo();
  expect(get().renewals.find((r) => r.id === 'demo-renewal-van-registration')!.dueDate).toBe('2031-04-27');
});

describe('pausing and closing', () => {
  test('pause keeps the item with the time it was paused; an edit keeps it paused; resume clears it', () => {
    const { actions, get } = setup();
    const item = () => get().serviceItems.find((i) => i.id === 'demo-item-van-oil')!;
    const before = item();
    const undo = actions.pauseServiceItem('demo-item-van-oil');
    expect(item()).toMatchObject({ pausedAt: DEMO_NOW, updatedAt: DEMO_NOW, by: before.by, lastDate: before.lastDate });
    actions.saveServiceItem('demo-item-van-oil', { vehicleId: 'demo-car-van', name: 'Oil change', everyMonths: 6, everyDistance: 5000, notes: 'Full synthetic' });
    expect(item()).toMatchObject({ pausedAt: DEMO_NOW, notes: 'Full synthetic' });
    actions.resumeServiceItem('demo-item-van-oil');
    expect('pausedAt' in item()).toBe(false);
    undo();
  });

  test('a logged visit keeps a paused item paused', () => {
    const { actions, get } = setup();
    actions.saveVisit(null, { vehicleId: 'demo-car-commuter', date: '2031-04-15', what: 'Underbody wash', serviceItemIds: ['demo-item-commuter-wash'] });
    expect(get().serviceItems.find((i) => i.id === 'demo-item-commuter-wash')).toMatchObject({ lastDate: '2031-04-15', pausedAt: new Date(2031, 0, 6, 18).getTime() });
  });

  test('closing a renewal keeps it closed through an edit; reopening and Undo put it back', () => {
    const { actions, get } = setup();
    const renewal = () => get().renewals.find((r) => r.id === 'demo-renewal-toll')!;
    const before = renewal();
    const undo = actions.closeRenewal('demo-renewal-toll');
    expect(renewal()).toMatchObject({ closedAt: DEMO_NOW, dueDate: before.dueDate, by: before.by });
    actions.saveRenewal('demo-renewal-toll', { kind: 'toll', name: 'Toll account', dueDate: '2031-09-30', everyMonths: 12, notes: 'Moved to the new tag' });
    expect(renewal().closedAt).toBe(DEMO_NOW);
    undo();
    actions.reopenRenewal('demo-renewal-commuter-permit');
    expect('closedAt' in get().renewals.find((r) => r.id === 'demo-renewal-commuter-permit')!).toBe(false);
  });
});
