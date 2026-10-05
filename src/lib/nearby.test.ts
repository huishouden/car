import { afterEach, describe, expect, test } from 'bun:test';
import { contactInput, type Contact } from '@huishouden/pwa-kit/contacts';
import { setHome } from '@huishouden/pwa-kit/home';
import { resetPlaceSearch, type Place } from '@huishouden/pwa-kit/places';
import overpass from './__fixtures__/overpass-car-repair.json';
import { APP } from './contacts';
import { findNearHome, NEARBY_KINDS, placePrefill, savedAs, withPlacePosition } from './nearby';
import { DEMO_HOME } from './demo';

const mechanic = NEARBY_KINDS.find((k) => k.id === 'mechanic')!;

/** Stands in for the map services, recording what was asked. */
function fakeFetch(body: unknown) {
  const asked: { url: string; body: string }[] = [];
  const fetch = (async (url: URL | string, init?: RequestInit) => {
    asked.push({ url: String(url), body: String(init?.body ?? '') });
    return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
  }) as typeof globalThis.fetch;
  return { fetch, asked };
}

afterEach(() => {
  setHome(undefined);
  resetPlaceSearch();
});

describe('finding shops near home', () => {
  test('asks Overpass for car repair around the household home, nearest first, each with its distance', async () => {
    setHome(DEMO_HOME);
    const { fetch, asked } = fakeFetch(overpass);
    const places = await findNearHome(mechanic, { fetch });
    expect(asked).toHaveLength(1);
    const query = decodeURIComponent(asked[0].body.replace(/\+/g, ' '));
    expect(query).toContain('around:10000,39.7817,-89.6501');
    expect(query).toContain('["shop"="car_repair"]');
    // The unnamed place is left out; the rest come nearest first.
    expect(places.map((p) => p.name)).toEqual(['Example Auto Service', 'Sample Lube & Tune']);
    expect(places[0].distanceKm).toBeCloseTo(1.42, 2);
    expect(places[1].distanceKm).toBeCloseTo(3.20, 1);
    expect(places[0].address).toBe('18 Example Street, Springfield');
  });

  test('without a home it asks nothing and finds nothing', async () => {
    const { fetch, asked } = fakeFetch(overpass);
    expect(await findNearHome(mechanic, { fetch })).toEqual([]);
    expect(asked).toHaveLength(0);
  });

  test('every kind of shop is one the map search knows', async () => {
    const { placeKinds } = await import('@huishouden/pwa-kit/places');
    for (const k of NEARBY_KINDS) expect(placeKinds(k.query).length).toBeGreaterThan(0);
  });
});

const place: Place = {
  name: 'Sample Lube & Tune',
  address: '40 Demo Road, Springfield',
  phone: '+1 555 010 0177',
  openingHours: 'Mo-Fr 08:00-18:00',
  lat: 39.8105,
  lon: -89.6501,
  osmUrl: 'https://www.openstreetmap.org/node/2000001',
  mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Sample%20Lube',
  distanceKm: 3.2,
};

describe('adding a found shop', () => {
  test('starts the shop with what the map has', () => {
    expect(placePrefill(place)).toEqual({
      name: 'Sample Lube & Tune',
      address: '40 Demo Road, Springfield',
      phone: '+1 555 010 0177',
      mapsUrl: place.mapsUrl,
      hours: 'Mo-Fr 08:00-18:00',
      confidence: 1,
      unparsed: [],
      ignored: [],
    });
  });

  test('keeps the place position while the address is the place address', () => {
    const input = contactInput({ name: 'Sample Lube & Tune', address: '40 Demo Road, Springfield', lat: 39.81, lng: -89.65 }, [], APP);
    expect(withPlacePosition(input, place)).toMatchObject({ lat: 39.8105, lng: -89.6501 });
  });

  test('an address changed in the dialog keeps what the dialog found for it', () => {
    const input = contactInput({ name: 'Sample Lube & Tune', address: '41 Demo Road, Springfield', lat: 39.9, lng: -89.7 }, [], APP);
    expect(withPlacePosition(input, place)).toBe(input);
    expect(withPlacePosition(input, undefined)).toBe(input);
  });

  test('a place already among the shops is recognised by name and address', () => {
    const shop = (name: string, address?: string): Contact => ({ id: name, name, address, apps: ['car'], createdAt: 1, by: 'sam@example.com' });
    expect(savedAs(place, [shop('sample lube & tune', '40 Demo Road, Springfield')])?.id).toBe('sample lube & tune');
    expect(savedAs(place, [shop('Sample Lube & Tune')])).toBeDefined();
    expect(savedAs(place, [shop('Sample Lube & Tune', '9 Other Street')])).toBeUndefined();
    expect(savedAs(place, [shop('Example Auto Service')])).toBeUndefined();
  });
});
