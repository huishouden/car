// Read budgets of Car's own sync paths (pwa-kit STANDARD.md "Read budgets"), on the emulators with
// the household's rules (`bun run e2e:emulator`, which `hh dev evidence` runs inside
// `firebase emulators:exec`): the sync on open (agenda, then to-do list), the reminders, and the
// publish after a write. Reads are counted from the SDK's own results as Firestore bills them
// (`readCounter().sdk`); the interleaving tests land another device's write before each read. Its
// own `bun test` process: it replaces firebase/firestore with the counted module for the process.
// A change that raises a ceiling says why in its PR.
import { afterAll, beforeAll, describe, expect, mock, test } from 'bun:test';
import { deleteApp, initializeApp, type FirebaseApp } from 'firebase/app';
import { expectReads, readCounter, writeBeforeEachRead } from '@huishouden/pwa-kit/read-test';
import { e2eProject, e2eTarget, seedTestHousehold, testHousehold, writeTestDocs, type TestHousehold } from '@huishouden/pwa-kit/staging';
import { agendaDoc } from '@huishouden/pwa-kit/agenda-core';
import { reminderDoc } from '@huishouden/pwa-kit/reminder-core';
import { todoDoc } from '@huishouden/pwa-kit/todo-core';
import { addDays, addMonths, toYmd } from '@huishouden/pwa-kit/time';
import type { CarData } from '../src/lib/demo';

const real = await import('firebase/firestore');
const counter = readCounter();
mock.module('firebase/firestore', () => counter.sdk(real));
const { connectFirestoreEmulator, initializeFirestore, memoryLocalCache, terminate } = await import('firebase/firestore');
const { publishChanges, publishReminders, syncAll, syncTodoList } = await import('../src/data/publishAgenda');

const emulator = e2eTarget() === 'emulator';
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
// Tomorrow at 10:30 local time, so the counts don't hang on when the test runs.
const NOW = new Date(new Date().setHours(0, 0, 0, 0) + DAY + 10.5 * HOUR).getTime();
const TODAY = toYmd(NOW);
// The rules take only the suite's own addresses.
const URL = 'https://huishouden-staging.web.app/car/';

let hh: TestHousehold;
let app: FirebaseApp;
let db: ReturnType<typeof real.getFirestore>;
let admin: string;

// An invented car: an oil change due in about two weeks and tyres done two months ago, two odometer
// readings and a visit, the registration due in ten days and the insurance in three months (both
// reminded), and a shop appointment in three days.
function data(name = 'Test hatchback'): CarData {
  const s = { createdAt: NOW - 400 * DAY, by: admin };
  return {
    vehicles: [{ id: 'car', name, ...s }],
    serviceItems: [
      { id: 'oil', vehicleId: 'car', name: 'Oil change', everyMonths: 6, lastDate: addDays(addMonths(TODAY, -6), 14), remind: true, ...s },
      { id: 'tyres', vehicleId: 'car', name: 'Tyre rotation', everyMonths: 12, lastDate: addMonths(TODAY, -2), ...s },
    ],
    readings: [
      { id: 'r1', vehicleId: 'car', date: addDays(TODAY, -60), reading: 20_000, ...s },
      { id: 'r2', vehicleId: 'car', date: addDays(TODAY, -5), reading: 21_500, ...s },
    ],
    renewals: [
      { id: 'reg', vehicleId: 'car', kind: 'registration', name: 'Registration', dueDate: addDays(TODAY, 10), everyMonths: 12, remind: true, ...s },
      { id: 'ins', vehicleId: 'car', kind: 'insurance', name: 'Insurance', dueDate: addDays(TODAY, 90), everyMonths: 12, remind: true, ...s },
    ],
    serviceLog: [{ id: 'v1', vehicleId: 'car', date: addMonths(TODAY, -2), what: 'Tyre rotation', serviceItemIds: ['tyres'], ...s }],
    appointments: [{ id: 'a1', vehicleId: 'car', title: 'Test shop visit', at: NOW + 3 * DAY, private: false, ...s }],
    contacts: [],
    settings: null,
  };
}

beforeAll(async () => {
  if (!emulator) return;
  const household = testHousehold('car-reads-sdk');
  admin = household.users.admin.email;
  // The records in Firestore too: the rules check what a reminder's source names.
  const d = data();
  const docs: Record<string, Record<string, unknown>> = {};
  const put = (col: string, list: { id: string }[]) => list.forEach(({ id, ...rest }) => (docs[`${col}/${id}`] = rest));
  put('carVehicles', d.vehicles);
  put('carServiceItems', d.serviceItems);
  put('carOdometer', d.readings);
  put('carRenewals', d.renewals);
  put('carServiceLog', d.serviceLog);
  put('carAppointments', d.appointments);
  hh = await seedTestHousehold({ household, docs });
  app = initializeApp({ apiKey: 'demo-key', projectId: e2eProject(), appId: 'demo' }, `reads-${hh.id}`);
  db = initializeFirestore(app, { localCache: memoryLocalCache() });
  connectFirestoreEmulator(db, process.env.HH_EMULATOR_HOST || '127.0.0.1', Number(process.env.HH_EMULATOR_FIRESTORE_PORT || 8080), {
    mockUserToken: { sub: hh.users.admin.uid, email: admin, email_verified: true },
  });
});

afterAll(async () => {
  if (!emulator) return;
  await terminate(db);
  await deleteApp(app);
});

const memory = () => {
  const notes = new Map<string, string>();
  return { getItem: (k: string) => notes.get(k) ?? null, setItem: (k: string, v: string) => void notes.set(k, v), removeItem: (k: string) => void notes.delete(k), key: (i: number) => [...notes.keys()][i] ?? null, get length() { return notes.size; } };
};
const fail = (e: unknown) => {
  throw e;
};

type List = 'agenda' | 'reminders' | 'todos';
/** Another device's stray item in `lists` (those a test's sync reads): the sync must remove it. */
const stray = (n: number, lists: List[]) => {
  const docs = {
    agenda: { [`agenda/car_stray_${n}`]: agendaDoc('car', { ref: `stray:${n}`, kind: 'due', title: `Old ${n}`, start: NOW + 2 * DAY, allDay: true, url: URL }, admin, NOW) },
    reminders: { [`reminders/car-stray-${n}`]: reminderDoc({ app: 'car', ref: `stray:${n}`, title: `Old ${n}`, at: NOW + 2 * DAY, url: URL }, admin, NOW) },
    todos: { [`todos/car:stray:${n}`]: todoDoc('car', { ref: `stray:${n}`, title: `Old ${n}`, createdAt: NOW - DAY, url: URL }, admin, NOW) },
  };
  return Object.assign({}, ...lists.map((l) => docs[l]));
};

describe.skipIf(!emulator)('on open: the agenda, then the to-do list, one query each, none when this device already published the same', () => {
  test('first, again, and again with this device\'s note', async () => {
    await expectReads(() => syncAll(db, hh.id, admin, data(), NOW, { published: null, appUrl: URL, onError: fail }), { max: 2, min: 2, counter, label: 'Car on open, first' });
    // Again: 4 agenda items (the oil change, the registration, the insurance, the shop visit) and 2
    // to-dos (the oil change and the registration, both coming up).
    await expectReads(() => syncAll(db, hh.id, admin, data(), NOW, { published: null, appUrl: URL, onError: fail }), { max: 6, min: 6, counter, label: 'Car on open, again' });
    const store = memory();
    await syncAll(db, hh.id, admin, data(), NOW, { published: store, appUrl: URL, onError: fail });
    await expectReads(() => syncAll(db, hh.id, admin, data(), NOW, { published: store, appUrl: URL, onError: fail }), { max: 0, counter, label: 'Car on open, published' });
  });

  test('interleaving: another device writes before each of its two reads; one pass, each read sees the strays written before it', async () => {
    let n = 0;
    // The agenda's 4 and the stray written before it; the to-dos' 2 and both strays.
    await expectReads(() => syncAll(db, hh.id, admin, data(), NOW, { published: null, appUrl: URL, onError: fail }), {
      max: 9,
      min: 9,
      counter,
      label: 'Car on open with a write before each read',
      beforeRead: writeBeforeEachRead(() => writeTestDocs(hh, stray(++n, ['agenda', 'todos']))),
    });
    expect(n).toBe(2);
    // What the reads saw is gone; the agenda stray written after the agenda's read is read and removed by the next run.
    await expectReads(() => syncAll(db, hh.id, admin, data(), NOW, { published: null, appUrl: URL, onError: fail }), { max: 7, min: 7, counter, label: 'Car on open, after' });
    await expectReads(() => syncAll(db, hh.id, admin, data(), NOW, { published: null, appUrl: URL, onError: fail }), { max: 6, min: 6, counter, label: 'Car on open, settled' });
  });

  test('the to-do list alone (a few seconds after a change)', async () => {
    await expectReads(() => syncTodoList(db, hh.id, admin, data(), NOW, { published: null, appUrl: URL, onError: fail }), { max: 2, min: 2, counter, label: 'Car to-dos' });
  });
});

describe.skipIf(!emulator)('the reminders: one query, none when this device already published the same', () => {
  test('first, again, with the note, and with a stray landing before the read', async () => {
    // First: the query finds two strays another device left, and removes them.
    await writeTestDocs(hh, { ...stray(30, ['reminders']), ...stray(31, ['reminders']) });
    await expectReads(() => publishReminders(db, hh.id, admin, data(), NOW, { published: null, onError: fail }), { max: 2, min: 2, counter, label: 'Car reminders, first' });
    // Again: the 8 it wrote (the oil change, the registration and the insurance, each at its lead times).
    const again = await expectReads(() => publishReminders(db, hh.id, admin, data(), NOW, { published: null, onError: fail }), { max: 8, min: 8, counter, label: 'Car reminders, again' });
    expect(again.value?.unchanged).toBe(8);
    const store = memory();
    await publishReminders(db, hh.id, admin, data(), NOW, { published: store, onError: fail });
    await expectReads(() => publishReminders(db, hh.id, admin, data(), NOW, { published: store, onError: fail }), { max: 0, counter, label: 'Car reminders, published' });
    // Interleaving: a stray lands before its read; read once and removed.
    const inter = await expectReads(() => publishReminders(db, hh.id, admin, data(), NOW, { published: null, onError: fail }), {
      max: 9,
      min: 9,
      counter,
      label: 'Car reminders with a write before the read',
      beforeRead: writeBeforeEachRead(() => writeTestDocs(hh, stray(10, ['reminders']))),
    });
    expect(inter.value).toMatchObject({ deleted: 1, unchanged: 8 });
  });
});

describe.skipIf(!emulator)('after a write: one query per record whose agenda items changed', () => {
  test('the registration renewed, and the car renamed (every item names it)', async () => {
    const before = data();
    const renewed = { ...before, renewals: before.renewals.map((r) => (r.id === 'reg' ? { ...r, dueDate: addMonths(r.dueDate, 12) } : r)) };
    // The registration's one item.
    await expectReads(() => publishChanges(db, hh.id, admin, before, renewed, [{ col: 'carRenewals', id: 'reg' }], NOW, { appUrl: URL, onError: fail }), { max: 1, min: 1, counter, label: 'Car after a renewal' });
    const renamed = data('Test estate');
    // Five records name the car: one query each.
    await expectReads(() => publishChanges(db, hh.id, admin, renewed, { ...renamed, renewals: renewed.renewals }, [{ col: 'carVehicles', id: 'car' }], NOW, { appUrl: URL, onError: fail }), { max: 5, min: 5, counter, label: 'Car after a rename' });
  });

  test('interleaving: the car renamed back with another device writing before each read', async () => {
    const before = { ...data('Test estate'), renewals: data().renewals.map((r) => (r.id === 'reg' ? { ...r, dueDate: addMonths(r.dueDate, 12) } : r)) };
    const after = { ...before, vehicles: data().vehicles };
    let n = 20;
    // Each query asks for one record's items, so the strays (other refs) are never read.
    await expectReads(() => publishChanges(db, hh.id, admin, before, after, [{ col: 'carVehicles', id: 'car' }], NOW, { appUrl: URL, onError: fail }), {
      max: 5,
      min: 5,
      counter,
      label: 'Car after a rename, with a write before each read',
      beforeRead: writeBeforeEachRead(() => writeTestDocs(hh, stray(++n, ['agenda']))),
    });
    expect(n - 20).toBe(5);
  });
});
