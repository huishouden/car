import { describe, expect, test } from 'bun:test';
import type { Firestore } from 'firebase/firestore';
import { DEMO_NOW, demoData } from '../lib/demo';
import { publishChanges, publishReminders, syncAll } from './publishAgenda';

// The publishers never reject: each failing step is reported and the next still runs. A Firestore
// that isn't one makes every step fail.
const broken = {} as Firestore;

describe('a failing step is reported and the next still runs', () => {
  test('a car renamed: one failure per record that names it', async () => {
    const before = demoData();
    const car = before.vehicles[0];
    const after = { ...before, vehicles: before.vehicles.map((v) => (v.id === car.id ? { ...v, name: `${v.name} II` } : v)) };
    const errors: unknown[] = [];
    await publishChanges(broken, 'h1', 'alex@example.com', before, after, [{ col: 'carVehicles', id: car.id }], DEMO_NOW, { onError: (e) => errors.push(e) });
    expect(errors.length).toBeGreaterThan(1);
  });

  test('on open: the agenda fails, the to-do list still runs; the reminders report and resolve to null', async () => {
    const errors: unknown[] = [];
    await syncAll(broken, 'h1', 'alex@example.com', demoData(), DEMO_NOW, { onError: (e) => errors.push(e) });
    expect(errors).toHaveLength(2);
    expect(await publishReminders(broken, 'h1', 'alex@example.com', demoData(), DEMO_NOW, { onError: (e) => errors.push(e) })).toBeNull();
    expect(errors).toHaveLength(3);
  });
});
