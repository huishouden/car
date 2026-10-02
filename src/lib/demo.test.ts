import { expect, test } from 'bun:test';
import { DEMO_NOW, demoData } from './demo';
import { parseYmd } from '@huishouden/pwa-kit/time';

// The repo is public: the sample household must be plainly invented.
const data = demoData();
const text = JSON.stringify(data);

test('sample dates sit around 2030 and 2031', () => {
  expect(new Date(DEMO_NOW).getFullYear()).toBe(2031);
  const dates = [...text.matchAll(/"(\d{4})-\d{2}-\d{2}"/g)].map((m) => Number(m[1]));
  expect(dates.length).toBeGreaterThan(10);
  for (const y of dates) expect(y === 2030 || y === 2031).toBe(true);
});

test('only example addresses and fictional phone numbers', () => {
  for (const m of text.matchAll(/[\w.+-]+@([\w.-]+)/g)) expect(m[1]).toMatch(/example\.com$/);
  for (const m of text.matchAll(/https?:\/\/([\w.-]+)/g)) expect(m[1]).toMatch(/example\.com$/);
  for (const m of text.matchAll(/\(555\) 010-(\d{4})/g)) expect(Number(m[1])).toBeLessThan(200);
  expect(text).not.toMatch(/\bvin\b|plate/i);
});

test('every reference points at something in the sample', () => {
  const cars = new Set(data.vehicles.map((v) => v.id));
  const shops = new Set(data.contacts.map((c) => c.id));
  const items = new Set(data.serviceItems.map((i) => i.id));
  for (const i of data.serviceItems) expect(cars.has(i.vehicleId)).toBe(true);
  for (const r of data.readings) expect(cars.has(r.vehicleId)).toBe(true);
  for (const e of data.serviceLog) {
    expect(cars.has(e.vehicleId)).toBe(true);
    if (e.shopId) expect(shops.has(e.shopId)).toBe(true);
    for (const id of e.serviceItemIds ?? []) expect(items.has(id)).toBe(true);
    expect(parseYmd(e.date)).not.toBeNull();
  }
  for (const a of data.appointments) if (a.shopId) expect(shops.has(a.shopId)).toBe(true);
});
