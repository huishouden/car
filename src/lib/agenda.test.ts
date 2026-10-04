import { describe, expect, test } from 'bun:test';
import { agendaDoc, agendaOpsAllowed, canEdit, fillEditOps, inAgendaWindow, toAgendaItem } from '@huishouden/pwa-kit/agenda';
import { toYmd } from '@huishouden/pwa-kit/time';
import { applyOps, createActions, type Backend, type Op } from '../data/actions';
import { AGENDA_APP, APP_URL, agendaChanges, agendaItems, type AgendaEntry } from './agenda';
import { DEMO_NOW, demoData, type CarData } from './demo';

// The sample household (two invented cars, 2031) as Car publishes it to the household agenda.
const data = demoData();

const line = (i: AgendaEntry & { ref?: string }) =>
  [i.ref, i.kind, i.title, i.allDay ? toYmd(i.start) : new Date(i.start).toString().slice(0, 21), i.detail ?? '-', i.who ?? '-', i.status ?? '-'].join(' | ');

describe('everything Car publishes', () => {
  const items = agendaItems(data, DEMO_NOW);

  test('service due dates, renewals and appointments, in the app’s own words', () => {
    expect(items.map(line)).toEqual([
      'service:demo-item-van-inspection | due | Inspection | 2031-03-28 | - | Family van | overdue',
      'renewal:demo-renewal-van-registration | renewal | Registration | 2031-04-27 | - | Family van | upcoming',
      'service:demo-item-van-oil | due | Oil change | 2031-04-29 | at 42,000 miles (estimated date) | Family van | upcoming',
      'service:demo-item-commuter-inspection | due | Inspection | 2031-05-02 | - | Commuter | upcoming',
      'renewal:demo-renewal-commuter-sticker | renewal | Inspection sticker | 2031-05-31 | - | Commuter | upcoming',
      'renewal:demo-renewal-insurance | renewal | Insurance | 2031-06-01 | - | - | upcoming',
      'service:demo-item-van-tires | due | Tire rotation | 2031-07-14 | at 44,600 miles (estimated date) | Family van | upcoming',
      'renewal:demo-renewal-commuter-registration | renewal | Registration | 2031-08-14 | - | Commuter | upcoming',
      'renewal:demo-renewal-toll | renewal | Toll account | 2031-09-30 | - | - | upcoming',
      'service:demo-item-commuter-oil | due | Oil change | 2031-10-17 | at 24,300 miles (estimated date) | Commuter | upcoming',
      'service:demo-item-commuter-tires | due | Tire rotation | 2031-10-17 | at 24,300 miles (estimated date) | Commuter | upcoming',
      'service:demo-item-van-cabin | due | Cabin air filter | 2031-11-08 | or at 52,000 miles | Family van | upcoming',
      'service:demo-item-commuter-wipers | due | Wiper blades | 2032-02-11 | - | Commuter | upcoming',
      'appointment:demo-appt-1 | appointment | Oil change | Tue Apr 22 2031 08:00 | Example Auto Service | Family van | -',
      'appointment:demo-appt-2 | appointment | Inspection | Tue Apr 29 2031 10:30 | Example Auto Service | Commuter | -',
      'appointment:demo-appt-3 | appointment | Tire rotation | Mon Jan 20 2031 09:00 | Sample Tire & Wheel | Family van | -',
    ]);
  });

  test('a service item with no record (van wiper blades) has nothing to publish', () => {
    expect(items.some((i) => i.ref === 'service:demo-item-van-wipers')).toBe(false);
  });

  test('every item is one the rules accept, linking to the app', () => {
    for (const i of items) {
      expect(i.url).toBe(APP_URL);
      expect(() => agendaDoc(AGENDA_APP, i, 'sam@example.com', DEMO_NOW)).not.toThrow();
    }
  });

  test('the kit keeps the window: past the 30 and 180 days left out, the overdue inspection kept', () => {
    const left = items.filter((i) => !inAgendaWindow(i, DEMO_NOW)).map((i) => i.ref);
    expect(left).toEqual([
      'service:demo-item-commuter-oil',
      'service:demo-item-commuter-tires',
      'service:demo-item-van-cabin',
      'service:demo-item-commuter-wipers',
      'appointment:demo-appt-3',
    ]);
  });
});

describe('service items', () => {
  const only = (d: CarData, ref: string) => agendaItems(d, DEMO_NOW).filter((i) => i.ref === ref);

  test('past its mileage: overdue on the day of the reading that showed it', () => {
    const d = { ...data, readings: [...data.readings, { id: 'r-new', vehicleId: 'demo-car-van', date: '2031-04-14' as const, reading: 42100, createdAt: DEMO_NOW, by: 'sam@example.com' }] };
    expect(only(d, 'service:demo-item-van-oil').map(line)).toEqual(['service:demo-item-van-oil | due | Oil change | 2031-04-14 | due at 42,000 miles | Family van | overdue']);
  });

  test('mileage-only with no pace to estimate from: skipped', () => {
    const d = { ...data, readings: [], serviceLog: [], serviceItems: data.serviceItems.filter((i) => i.vehicleId !== 'demo-car-commuter' || i.id === 'demo-item-commuter-tires') };
    expect(only(d, 'service:demo-item-commuter-tires')).toEqual([]);
  });

  test('the household’s distance unit is used in the detail', () => {
    const d = { ...data, settings: { ...data.settings!, distanceUnit: 'km' as const } };
    expect(only(d, 'service:demo-item-van-cabin')[0].detail).toBe('or at 52,000 kilometers');
  });

  test('a deleted car’s schedule and renewals are not published; household-wide ones stay', () => {
    const refs = agendaItems({ ...data, vehicles: data.vehicles.filter((v) => v.id !== 'demo-car-van') }, DEMO_NOW).map((i) => i.ref);
    expect(refs.some((r) => r.includes('-van-') || r === 'appointment:demo-appt-1')).toBe(false);
    expect(refs).toContain('renewal:demo-renewal-insurance');
  });
});

test('an overdue renewal and an appointment without a shop', () => {
  const d: CarData = {
    ...data,
    renewals: data.renewals.map((r) => (r.id === 'demo-renewal-insurance' ? { ...r, dueDate: '2031-04-01' } : r)),
    appointments: data.appointments.map((a) => (a.id === 'demo-appt-2' ? { ...a, shopId: undefined } : a)),
  };
  const items = agendaItems(d, DEMO_NOW);
  expect(items.find((i) => i.ref === 'renewal:demo-renewal-insurance')?.status).toBe('overdue');
  expect(items.find((i) => i.ref === 'appointment:demo-appt-2')?.detail).toBe('18 Example Street, Springfield');
});

// What one action's write changes on the agenda, through the real actions over a memory backend.
function act(run: (a: ReturnType<typeof createActions>) => void, start: CarData = demoData()) {
  let current = start;
  const writes: Op[][] = [];
  const backend: Backend = {
    newId: (col) => `${col}-new`,
    write: (ops) => {
      writes.push(ops);
      current = applyOps(current, ops);
    },
    saveSettings: () => {},
    contacts: { save: () => {}, remove: () => {}, restore: () => {} },
  };
  run(createActions(backend, () => current, 'alex@example.com', () => DEMO_NOW));
  return agendaChanges(start, current, writes.flat(), DEMO_NOW);
}

describe('publishing a save', () => {
  test('logging an oil change moves its next due, and the new odometer point the tire rotation estimate', () => {
    const changes = act((a) => a.saveVisit(null, { vehicleId: 'demo-car-van', date: '2031-04-15', odometer: 41450, what: 'Oil change', serviceItemIds: ['demo-item-van-oil'] }));
    expect(changes.remove).toEqual([]);
    expect(changes.replace.map((c) => [c.ref, c.items.map(line)])).toEqual([
      ['service:demo-item-van-oil', [' | due | Oil change | 2031-09-08 | at 46,450 miles (estimated date) | Family van | upcoming']],
      ['service:demo-item-van-tires', [' | due | Tire rotation | 2031-07-16 | at 44,600 miles (estimated date) | Family van | upcoming']],
    ]);
  });

  test('an odometer reading moves the mileage estimates of that car only', () => {
    const changes = act((a) => a.logReading({ vehicleId: 'demo-car-commuter', date: '2031-04-15', reading: 22000 }));
    expect(changes.replace.map((c) => c.ref)).toEqual(['service:demo-item-commuter-oil', 'service:demo-item-commuter-tires']);
  });

  test('renaming a car republishes everything it is on', () => {
    const changes = act((a) => a.saveVehicle('demo-car-commuter', { name: 'Little car' }));
    expect(changes.replace.map((c) => c.ref)).toEqual([
      'appointment:demo-appt-2',
      'renewal:demo-renewal-commuter-registration',
      'renewal:demo-renewal-commuter-sticker',
      'service:demo-item-commuter-inspection',
      'service:demo-item-commuter-oil',
      'service:demo-item-commuter-tires',
      'service:demo-item-commuter-wipers',
    ]);
    expect(changes.replace.every((c) => c.items.every((i) => i.who === 'Little car'))).toBe(true);
  });

  test('a saved renewal is replaced even when nothing shows a difference; a deleted one removed', () => {
    expect(act((a) => a.markRenewed('demo-renewal-toll')).replace.map((c) => [c.ref, toYmd(c.items[0].start)])).toEqual([['renewal:demo-renewal-toll', '2032-09-30']]);
    expect(act((a) => a.deleteRenewal('demo-renewal-toll'))).toEqual({ replace: [], remove: ['renewal:demo-renewal-toll'] });
  });

  test('deleting a car removes all of its records', () => {
    const changes = act((a) => a.deleteVehicle('demo-car-commuter'));
    expect(changes.replace).toEqual([]);
    expect(changes.remove).toEqual([
      'appointment:demo-appt-2',
      'renewal:demo-renewal-commuter-permit',
      'renewal:demo-renewal-commuter-registration',
      'renewal:demo-renewal-commuter-sticker',
      'service:demo-item-commuter-inspection',
      'service:demo-item-commuter-oil',
      'service:demo-item-commuter-tires',
      'service:demo-item-commuter-wash',
      'service:demo-item-commuter-wipers',
    ]);
  });

  test('a new appointment is published; a renamed shop updates the appointments that name it', () => {
    const added = act((a) => a.saveAppointment(null, { vehicleId: 'demo-car-van', title: 'Brakes', at: new Date(2031, 4, 6, 9).getTime(), shopId: 'demo-shop-tires' }));
    expect(added.replace.map((c) => [c.ref, c.items.map((i) => i.detail)])).toEqual([['appointment:carAppointments-new', ['Sample Tire & Wheel']]]);
    const before = demoData();
    const after = { ...before, contacts: before.contacts.map((c) => (c.id === 'demo-shop-auto' ? { ...c, name: 'Example Auto Care' } : c)) };
    expect(agendaChanges(before, after, [], DEMO_NOW).replace.map((c) => c.ref)).toEqual(['appointment:demo-appt-1', 'appointment:demo-appt-2']);
  });

  test('pausing a service item or closing a renewal takes it off the agenda; resuming puts it back', () => {
    expect(act((a) => a.pauseServiceItem('demo-item-van-inspection'))).toEqual({ replace: [{ ref: 'service:demo-item-van-inspection', items: [] }], remove: [] });
    expect(act((a) => a.closeRenewal('demo-renewal-toll'))).toEqual({ replace: [{ ref: 'renewal:demo-renewal-toll', items: [] }], remove: [] });
    expect(act((a) => a.resumeServiceItem('demo-item-commuter-wash')).replace.map((c) => [c.ref, c.items.map((i) => i.status)])).toEqual([['service:demo-item-commuter-wash', ['overdue']]]);
  });

  test('a write that changes no dates publishes nothing', () => {
    expect(act((a) => a.saveVisit('demo-visit-6', { vehicleId: 'demo-car-commuter', date: '2031-02-11', what: 'Wiper blades', notes: 'Cheap ones.' }))).toEqual({ replace: [], remove: [] });
  });
});

describe('edits for changes made in a calendar', () => {
  const items = agendaItems(data, DEMO_NOW);
  const of = (prefix: string) => items.find((i) => i.ref.startsWith(prefix))!;

  test('each item’s edits write only Car’s own collections, and the kit accepts them', () => {
    for (const i of items) {
      for (const action of Object.values(i.edit ?? {})) expect(agendaOpsAllowed('car', action!.ops)).toBe(true);
      expect(() => agendaDoc('car', i, 'a@example.com')).not.toThrow();
    }
  });

  test('an appointment moves by its time, is renamed, re-noted or cancelled; by staff or whoever added it', () => {
    const a = of('appointment:');
    const id = a.ref.slice('appointment:'.length);
    expect(Object.keys(a.edit!).sort()).toEqual(['cancel', 'notes', 'rename', 'reschedule']);
    const [op] = fillEditOps(a.edit!.reschedule!.ops, { start: 123 });
    expect(op).toEqual({ col: 'carAppointments', id, data: { at: 123, updatedAt: '$now' }, merge: true });
    expect(a.edit!.cancel!.ops).toEqual([{ col: 'carAppointments', id, data: null }]);
    const item = toAgendaItem('x', { ...agendaDoc('car', a, 'a@example.com') });
    const by = data.appointments.find((x) => x.id === id)!.by;
    expect(canEdit(item, 'reschedule', 'member', 'm@example.com')).toBe(true);
    expect(canEdit(item, 'reschedule', 'helper', 'someone-else@example.com')).toBe(false);
    expect(canEdit(item, 'reschedule', 'helper', by)).toBe(true);
  });

  test('a renewal moves by its due date, which any member may tick', () => {
    const r = of('renewal:');
    const [op] = fillEditOps(r.edit!.reschedule!.ops, { date: '2031-03-01' });
    expect(op.data).toEqual({ dueDate: '2031-03-01', updatedAt: '$now' });
    expect(r.edit!.reschedule!.roles).toEqual(['admin', 'member', 'helper']);
  });

  test('a service item can only be renamed: its due day follows the schedule', () => {
    const s = of('service:');
    expect(Object.keys(s.edit!)).toEqual(['rename']);
  });
});
