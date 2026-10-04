import { describe, expect, test } from 'bun:test';
import { allDayStart } from '@huishouden/pwa-kit/agenda';
import { resolveOps, todoDoc, todoOpsAllowed, type TodoInput } from '@huishouden/pwa-kit/todos';
import { toYmd } from '@huishouden/pwa-kit/time';
import type { Op as KitOp } from '@huishouden/pwa-kit/store';
import { applyOps, createActions, type Backend, type Op } from '../data/actions';
import { APP_URL } from './agenda';
import { DEMO_NOW, demoData, type CarData } from './demo';
import { upcoming } from './upcoming';
import { TODO_APP, renewalTitle, todoItems, todoVisitId } from './todos';

// The sample household (two invented cars, 2031) as Car publishes it to the household to-do list.
const ME = 'jo@example.com';
const LATER = DEMO_NOW + 3 * 86_400_000;

const line = (i: TodoInput) => [i.ref, i.title, i.detail ?? '-', i.due === undefined ? '-' : toYmd(i.due), i.who ?? '-', i.owner, i.done?.label, i.cancel?.label].join(' | ');
const find = (items: TodoInput[], ref: string) => items.find((i) => i.ref === ref)!;

/** The actions as the app runs them, as `ME`, on its own copy of the sample. */
function app(now = LATER) {
  let data: CarData = demoData();
  let seq = 0;
  const backend: Backend = {
    newId: (col) => `${col}-${seq++}`,
    write: (ops) => {
      data = applyOps(data, ops);
    },
    saveSettings: () => {},
    contacts: { save: () => {}, remove: () => {}, restore: () => {} },
  };
  return { actions: createActions(backend, () => data, ME, () => now), get: () => data };
}

/** What the portal does with an action: fills in the placeholders as `ME` at `now` and writes. */
const run = (data: CarData, ops: KitOp[], now = LATER) => applyOps(data, resolveOps(ops, { now, me: ME }) as Op[]);

describe('what Car publishes', () => {
  const data = demoData();
  const items = todoItems(data, DEMO_NOW);

  test('the four things the Overview says need doing soon, in its order', () => {
    expect(items.map(line)).toEqual([
      'service:demo-item-van-inspection | Inspection | - | 2031-03-28 | Family van | sam@example.com | Done | Pause',
      'renewal:demo-renewal-van-registration | Renew registration | Every year | 2031-04-27 | Family van | sam@example.com | Renewed | Mark handled',
      'service:demo-item-van-oil | Oil change | at 42,000 miles (estimated date) | 2031-04-29 | Family van | sam@example.com | Done | Pause',
      'service:demo-item-commuter-inspection | Inspection | - | 2031-05-02 | Commuter | sam@example.com | Done | Pause',
    ]);
  });

  test('left out: later items, no-record items, a paused item and a closed renewal', () => {
    const refs = items.map((i) => i.ref);
    for (const ref of ['renewal:demo-renewal-insurance', 'service:demo-item-van-wipers', 'service:demo-item-commuter-wash', 'renewal:demo-renewal-commuter-permit']) expect(refs).not.toContain(ref);
    // The paused wash would be overdue, the closed permit is past its date.
    const unpaused = { ...data, serviceItems: data.serviceItems.map(({ pausedAt: _p, ...i }) => i), renewals: data.renewals.map(({ closedAt: _c, ...r }) => r) };
    expect(todoItems(unpaused, DEMO_NOW).map((i) => i.ref)).toEqual(expect.arrayContaining(['service:demo-item-commuter-wash', 'renewal:demo-renewal-commuter-permit']));
  });

  test('createdAt is when the record was added; due is the local midnight of its due day', () => {
    const reg = find(items, 'renewal:demo-renewal-van-registration');
    expect(reg.createdAt).toBe(data.renewals.find((r) => r.id === 'demo-renewal-van-registration')!.createdAt);
    expect(reg.due).toBe(allDayStart('2031-04-27'));
    expect(find(items, 'service:demo-item-van-inspection').createdAt).toBe(data.serviceItems.find((i) => i.id === 'demo-item-van-inspection')!.createdAt);
  });

  test('an all-cars renewal has no who', () => {
    const soon = todoItems(data, new Date(2031, 4, 10, 9).getTime());
    expect(find(soon, 'renewal:demo-renewal-insurance')).toMatchObject({ title: 'Renew insurance' });
    expect(find(soon, 'renewal:demo-renewal-insurance').who).toBeUndefined();
  });

  test('every item is one the rules accept, linking to the app, writing only Car’s collections', () => {
    for (const i of items) {
      expect(i.url).toBe(APP_URL);
      expect(i.private).toBeUndefined();
      expect(() => todoDoc(TODO_APP, i, 'sam@example.com', DEMO_NOW)).not.toThrow();
      expect(todoOpsAllowed(TODO_APP, i.done!.ops)).toBe(true);
      expect(todoOpsAllowed(TODO_APP, i.cancel!.ops)).toBe(true);
    }
  });
});

describe('Done on a service item', () => {
  const item = find(todoItems(demoData(), DEMO_NOW), 'service:demo-item-van-oil');

  test('logs a visit as the member who taps it and moves the item forward, with placeholders', () => {
    expect(item.done).toEqual({
      label: 'Done',
      roles: ['admin', 'member', 'helper', 'kid'],
      ops: [
        {
          col: 'carServiceLog',
          id: 'todo-demo-item-van-oil-2030-11-08',
          data: { vehicleId: 'demo-car-van', date: '$today', odometer: 41400, what: 'Oil change', serviceItemIds: ['demo-item-van-oil'], createdAt: '$now', by: '$me' },
        },
        { col: 'carServiceItems', id: 'demo-item-van-oil', data: { lastDate: '$today', lastOdometer: 41400, updatedAt: '$now' }, merge: true },
      ],
    });
    expect(item.done!.ops[0].id).toBe(todoVisitId({ id: 'demo-item-van-oil', lastDate: '2030-11-08' }));
  });

  test('writes what Car’s own Done writes when its form is saved as offered', () => {
    const portal = run(demoData(), item.done!.ops);
    const own = app();
    own.actions.saveVisit(null, { vehicleId: 'demo-car-van', serviceItemIds: ['demo-item-van-oil'], what: 'Oil change', date: toYmd(LATER), odometer: 41400 });
    const oil = (d: CarData) => d.serviceItems.find((i) => i.id === 'demo-item-van-oil');
    expect(oil(portal)).toEqual(oil(own.get()));
    const { id: _a, ...logged } = portal.serviceLog.find((e) => e.id === item.done!.ops[0].id)!;
    const { id: _b, ...ownLogged } = own.get().serviceLog.find((e) => e.id.startsWith('carServiceLog-'))!;
    expect(logged).toEqual(ownLogged);
    // Done, it no longer comes due, so it isn't published again.
    expect(todoItems(portal, LATER).map((i) => i.ref)).not.toContain('service:demo-item-van-oil');
  });

  test('without any odometer reading, the visit and the item record the day only', () => {
    const data = demoData();
    const bare = { ...data, readings: [], serviceLog: [], serviceItems: data.serviceItems.map(({ lastOdometer: _o, ...i }) => i) };
    const insp = find(todoItems(bare, DEMO_NOW), 'service:demo-item-van-inspection');
    expect(insp.done!.ops.map((o) => o.data)).toEqual([
      { vehicleId: 'demo-car-van', date: '$today', what: 'Inspection', serviceItemIds: ['demo-item-van-inspection'], createdAt: '$now', by: '$me' },
      { lastDate: '$today', updatedAt: '$now' },
    ]);
  });
});

describe('Pause on a service item', () => {
  const item = find(todoItems(demoData(), DEMO_NOW), 'service:demo-item-van-inspection');

  test('sets pausedAt, for admins, members and whoever added it', () => {
    expect(item.cancel).toEqual({
      label: 'Pause',
      roles: ['admin', 'member'],
      owner: true,
      ops: [{ col: 'carServiceItems', id: 'demo-item-van-inspection', data: { pausedAt: '$now', updatedAt: '$now' }, merge: true }],
    });
  });

  test('is Car’s own Pause: paused, it leaves the list and Car shows it set aside', () => {
    const portal = run(demoData(), item.cancel!.ops);
    const own = app();
    own.actions.pauseServiceItem('demo-item-van-inspection');
    const insp = (d: CarData) => d.serviceItems.find((i) => i.id === 'demo-item-van-inspection');
    expect(insp(portal)).toEqual(insp(own.get()));
    expect(todoItems(portal, LATER).map((i) => i.ref)).not.toContain('service:demo-item-van-inspection');
    expect(upcoming(portal, 'mi', LATER).some((e) => e.id === 'demo-item-van-inspection')).toBe(false);
  });
});

describe('renewals', () => {
  const items = todoItems(demoData(), DEMO_NOW);
  const reg = find(items, 'renewal:demo-renewal-van-registration');

  test('Renewed on a repeating one moves the due date a cycle on from the due date; anyone may', () => {
    expect(reg.done).toEqual({
      label: 'Renewed',
      roles: ['admin', 'member', 'helper', 'kid'],
      ops: [{ col: 'carRenewals', id: 'demo-renewal-van-registration', data: { dueDate: '2032-04-27', updatedAt: '$now' }, merge: true }],
    });
    const portal = run(demoData(), reg.done!.ops);
    const own = app();
    own.actions.markRenewed('demo-renewal-van-registration');
    const r = (d: CarData) => d.renewals.find((x) => x.id === 'demo-renewal-van-registration');
    expect(r(portal)).toEqual(r(own.get()));
    expect(todoItems(portal, LATER).map((i) => i.ref)).not.toContain('renewal:demo-renewal-van-registration');
  });

  test('Renewed on one that doesn’t repeat closes it, for staff and its owner', () => {
    const data = demoData();
    const once = { ...data, renewals: data.renewals.map(({ everyMonths: _e, ...r }) => r) };
    const item = find(todoItems(once, DEMO_NOW), 'renewal:demo-renewal-van-registration');
    expect(item.detail).toBe('Once');
    expect(item.done).toEqual({
      label: 'Renewed',
      roles: ['admin', 'member'],
      owner: true,
      ops: [{ col: 'carRenewals', id: 'demo-renewal-van-registration', data: { closedAt: '$now', updatedAt: '$now' }, merge: true }],
    });
  });

  test('Mark handled closes it as Car’s own does, and it stops coming due', () => {
    expect(reg.cancel).toEqual({
      label: 'Mark handled',
      roles: ['admin', 'member'],
      owner: true,
      ops: [{ col: 'carRenewals', id: 'demo-renewal-van-registration', data: { closedAt: '$now', updatedAt: '$now' }, merge: true }],
    });
    const portal = run(demoData(), reg.cancel!.ops);
    const own = app();
    own.actions.closeRenewal('demo-renewal-van-registration');
    const r = (d: CarData) => d.renewals.find((x) => x.id === 'demo-renewal-van-registration');
    expect(r(portal)).toEqual(r(own.get()));
    expect(todoItems(portal, LATER).map((i) => i.ref)).not.toContain('renewal:demo-renewal-van-registration');
  });

  test('titles: a kind’s own name reads lower-case, anything else as written', () => {
    expect(renewalTitle('Registration')).toBe('Renew registration');
    expect(renewalTitle('Inspection sticker')).toBe('Renew inspection sticker');
    expect(renewalTitle('E-ZPass')).toBe('Renew E-ZPass');
    expect(renewalTitle('E2E todo 123')).toBe('Renew E2E todo 123');
  });
});

test('to-dos carry their words in every language; a renewal kind saved in another language reads lower-case', async () => {
  const { localizeTodos } = await import('@huishouden/pwa-kit/todos');
  const data = demoData();
  const items = await localizeTodos(() => todoItems(data, DEMO_NOW));
  const renewal = items.find((i) => i.ref.startsWith('renewal:'))!;
  expect(renewal.texts.en).toMatchObject({ title: 'Renew registration', done: 'Renewed', cancel: 'Mark handled' });
  expect(renewal.texts.es).toMatchObject({ title: 'Renovar registration', done: 'Renovado', cancel: 'Marcar resuelto' });
  expect(renewal.texts.nl).toMatchObject({ done: 'Verlengd', cancel: 'Afgehandeld' });
  const service = items.find((i) => i.ref.startsWith('service:'))!;
  expect([service.texts.en?.done, service.texts.es?.done, service.texts.nl?.done]).toEqual(['Done', 'Listo', 'Klaar']);
  expect(renewalTitle('APK')).toBe('Renew apk');
  expect(renewalTitle('E-ZPass')).toBe('Renew E-ZPass');
});
