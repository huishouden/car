import { describe, expect, test } from 'bun:test';
import { zonedTime } from '@huishouden/pwa-kit/ics';
import { readSource, sourceAllowed, stillDue } from '@huishouden/pwa-kit/reminder-source';
import { localizeReminders } from '@huishouden/pwa-kit/reminders';
import { demoData } from './demo';
import { carReminders, renewalReminderRef, renewalSource, serviceReminderRef, serviceSource } from './reminders';

const ZONE = 'America/New_York';
const NOW = zonedTime('2031-04-15', '09:30', ZONE);
const at9 = (day: string) => zonedTime(day, '09:00', ZONE);
const data = demoData();
const list = (d = data, now = NOW) => carReminders(d, now, ZONE);
const forRef = (ref: string, d = data) => list(d).filter((r) => r.ref === ref);

describe('renewals', () => {
  test('remind a week before and on the due day, at 9:00 on the household clock', () => {
    const rs = forRef(renewalReminderRef('demo-renewal-van-registration'));
    expect(rs.map((r) => r.at)).toEqual([at9('2031-04-20'), at9('2031-04-27')]);
    expect(rs.map((r) => r.title)).toEqual(['Registration is due in a week', 'Registration is due today']);
    expect(rs[0].body).toBe('Family van');
    expect(rs.every((r) => r.recipients === 'all' && r.private === false)).toBe(true);
  });

  test('a renewal for every car has no car in the body', () => {
    expect(forRef(renewalReminderRef('demo-renewal-insurance'))[0].body).toBe('');
  });

  test('past times are left out: the early one when it has passed, both when the day has', () => {
    const early = forRef(renewalReminderRef('demo-renewal-commuter-sticker'));
    expect(early.map((r) => r.at)).toEqual([at9('2031-05-24'), at9('2031-05-31')]);
    const late = carReminders(data, zonedTime('2031-04-24', '12:00', ZONE), ZONE).filter((r) => r.ref === renewalReminderRef('demo-renewal-van-registration'));
    expect(late.map((r) => r.at)).toEqual([at9('2031-04-27')]);
    expect(carReminders(data, zonedTime('2031-04-28', '12:00', ZONE), ZONE).some((r) => r.ref === renewalReminderRef('demo-renewal-van-registration'))).toBe(false);
  });

  test('a closed renewal has none', () => {
    expect(forRef(renewalReminderRef('demo-renewal-commuter-permit'))).toEqual([]);
  });

  test('"remind" off for one renewal leaves the others', () => {
    const off = { ...data, renewals: data.renewals.map((r) => (r.id === 'demo-renewal-van-registration' ? { ...r, remind: false } : r)) };
    expect(forRef(renewalReminderRef('demo-renewal-van-registration'), off)).toEqual([]);
    expect(forRef(renewalReminderRef('demo-renewal-insurance'), off)).toHaveLength(2);
  });

  test("a renewal of a deleted car has none", () => {
    const gone = { ...data, vehicles: data.vehicles.filter((v) => v.id !== 'demo-car-commuter') };
    expect(forRef(renewalReminderRef('demo-renewal-commuter-sticker'), gone)).toEqual([]);
  });
});

describe('service items', () => {
  test('remind a week before and on the day the last date plus the interval falls', () => {
    const rs = forRef(serviceReminderRef('demo-item-van-oil'));
    expect(rs.map((r) => r.at)).toEqual([at9('2031-05-01'), at9('2031-05-08')]);
    expect(rs[1].title).toBe('Oil change is due today');
    expect(rs[1].body).toBe('Family van');
  });

  test('distance-only, never-done, paused and overdue items have none', () => {
    const refs = new Set(list().map((r) => r.ref));
    expect(refs.has(serviceReminderRef('demo-item-commuter-tires'))).toBe(false);
    expect(refs.has(serviceReminderRef('demo-item-van-wipers'))).toBe(false);
    expect(refs.has(serviceReminderRef('demo-item-commuter-wash'))).toBe(false);
    expect(refs.has(serviceReminderRef('demo-item-van-inspection'))).toBe(false);
  });

  test('"remind" off for one item leaves the others', () => {
    const off = { ...data, serviceItems: data.serviceItems.map((i) => (i.id === 'demo-item-van-oil' ? { ...i, remind: false } : i)) };
    expect(forRef(serviceReminderRef('demo-item-van-oil'), off)).toEqual([]);
    expect(forRef(serviceReminderRef('demo-item-van-cabin'), off).length).toBeGreaterThan(0);
  });
});

describe('sources', () => {
  test('a renewal is due while open and on the same date; renewed, closed or removed it is not', () => {
    const r = data.renewals[0];
    const source = renewalSource(r);
    expect(source).toEqual({ checks: [{ doc: `carRenewals/${r.id}`, due: [{ field: 'closedAt', in: [null] }, { field: 'dueDate', in: [r.dueDate] }] }] });
    expect(sourceAllowed('car', source, 'sam@example.com', 'member', new Map())).toBe(true);
    expect(readSource('car', source)).toEqual(source);
    const check = (doc: Record<string, unknown> | null) => stillDue(source, new Map([[`carRenewals/${r.id}`, doc]]));
    expect(check({ dueDate: r.dueDate })).toBe(true);
    expect(check({ dueDate: '2032-04-27' })).toBe(false);
    expect(check({ dueDate: r.dueDate, closedAt: 5 })).toBe(false);
    expect(check(null)).toBe(false);
  });

  test('a service item is due until it is serviced, paused or removed', () => {
    const i = data.serviceItems.find((x) => x.id === 'demo-item-van-oil')!;
    const source = serviceSource(i);
    expect(sourceAllowed('car', source, 'sam@example.com', 'helper', new Map())).toBe(true);
    const check = (doc: Record<string, unknown> | null) => stillDue(source, new Map([[`carServiceItems/${i.id}`, doc]]));
    expect(check({ lastDate: i.lastDate })).toBe(true);
    expect(check({ lastDate: '2031-04-15' })).toBe(false);
    expect(check({ lastDate: i.lastDate, pausedAt: 5 })).toBe(false);
    expect(check(null)).toBe(false);
  });

  test('every reminder carries its source', () => {
    expect(list().every((r) => (r.source?.checks.length ?? 0) === 1)).toBe(true);
  });
});

describe('languages', () => {
  test('each reminder carries its words in English, Spanish and Dutch', async () => {
    const rs = await localizeReminders(() => list());
    const r = rs.find((x) => x.ref === serviceReminderRef('demo-item-van-oil') && x.at === at9('2031-05-08'))!;
    expect(r.texts?.en?.title).toBe('Oil change is due today');
    // The item's name is the household's own text; the sentence around it follows the language.
    expect(r.texts?.es?.title).toBe('Oil change vence hoy');
    expect(r.texts?.nl?.title).toBe('Oil change is vandaag aan de beurt');
  });
});
