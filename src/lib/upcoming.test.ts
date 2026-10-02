import { describe, expect, test } from 'bun:test';
import { DEMO_NOW, demoData } from './demo';
import { carOdometer, needsAttention, upcoming } from './upcoming';

// The sample household: two cars with a mix of overdue, soon and later items.
const data = demoData();

describe('coming up across every car', () => {
  const list = upcoming(data, 'mi', DEMO_NOW);

  test('overdue first, then soonest, then later, and no-record last', () => {
    expect(list.map((i) => `${i.vehicle?.name ?? 'All cars'}: ${i.text}`)).toEqual([
      'Family van: Inspection overdue by 2 weeks',
      'Family van: Registration expires in 12 days',
      'Family van: Oil change due in 600 miles or 3 weeks',
      'Commuter: Inspection due in 2 weeks',
      'Commuter: Inspection sticker expires in 6 weeks',
      'All cars: Insurance renews in 6 weeks',
      'Family van: Tire rotation due in 3,200 miles or 3 months',
      'Commuter: Registration expires in 3 months',
      'All cars: Toll account renews in 5 months',
      'Commuter: Oil change due in 4,550 miles or 8 months',
      'Commuter: Tire rotation due in 4,550 miles (about 6 months)',
      'Family van: Cabin air filter due in 10,600 miles or 6 months',
      'Commuter: Wiper blades due in 9 months',
      'Family van: Wiper blades: no record yet',
    ]);
    expect(needsAttention(list)).toBe(4);
  });

  test('a deleted car takes its schedule and renewals off the list', () => {
    const rest = upcoming({ ...data, vehicles: data.vehicles.filter((v) => v.id !== 'demo-car-van') }, 'mi', DEMO_NOW);
    expect(rest.some((i) => i.vehicle?.name === 'Family van')).toBe(false);
    expect(rest.some((i) => i.text.startsWith('Insurance'))).toBe(true);
  });
});

test('odometer takes readings, service visits and schedule records into account', () => {
  const odo = carOdometer('demo-car-van', data.readings, data.serviceLog, data.serviceItems);
  expect(odo.latest).toEqual({ date: '2031-04-12', reading: 41400 });
  expect(odo.pace).toBeCloseTo(12200 / 357, 6);
  const none = carOdometer('nope', data.readings, data.serviceLog, data.serviceItems);
  expect(none).toEqual({ latest: null, pace: null });
});
