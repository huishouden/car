import { describe, expect, test } from 'bun:test';
import { defaultDistance, formatDistance, formatReading, householdUnit, localeUnit, parseReading, unitWord } from './distance';

describe('distance', () => {
  test.each([
    [42180, 'mi', '42,180 miles'],
    [1, 'mi', '1 mile'],
    [600, 'km', '600 kilometers'],
    [-400, 'mi', '400 miles'],
  ] as const)('%p %s', (n, unit, text) => expect(formatDistance(n, unit)).toBe(text));

  test('readings as people type them', () => {
    expect(parseReading('42,180')).toBe(42180);
    expect(parseReading(' 42 180 ')).toBe(42180);
    expect(parseReading('42180')).toBe(42180);
    expect(parseReading('')).toBeNull();
    expect(parseReading('-5')).toBeNull();
    expect(parseReading('12345678')).toBeNull();
    expect(formatReading(41400)).toBe('41,400');
  });

  test('default intervals in kilometers round to the nearest thousand', () => {
    expect(defaultDistance(5000, 'mi')).toBe(5000);
    expect(defaultDistance(5000, 'km')).toBe(8000);
    expect(defaultDistance(6000, 'km')).toBe(10000);
  });
});

describe('in the page locale', () => {
  test.each([
    ['es-MX', 42180, 'mi', '42,180 millas'],
    ['es-ES', 600, 'km', '600 kilómetros'],
    ['nl-NL', 42180, 'km', '42.180 kilometer'],
  ] as const)('%s: %p %s', (locale, n, unit, text) => expect(formatDistance(n, unit, locale)).toBe(text));

  test('the unit word and grouping follow the locale', () => {
    expect(unitWord('mi', 'nl-NL')).toBe('mijl');
    expect(unitWord('km', 'es-MX')).toBe('kilómetros');
    expect(formatReading(41400, 'nl-NL')).toBe('41.400');
    expect(parseReading('41.400')).toBe(41400);
  });

  test('a household without a unit: miles once it has cars, the locale’s unit before', () => {
    expect(localeUnit('nl-NL')).toBe('km');
    expect(localeUnit('en-US')).toBe('mi');
    expect(localeUnit('en-GB')).toBe('mi');
    expect(householdUnit({ settings: null, vehicles: [] }, 'nl-NL')).toBe('km');
    expect(householdUnit({ settings: null, vehicles: [{}] }, 'nl-NL')).toBe('mi');
    expect(householdUnit({ settings: { distanceUnit: 'km' }, vehicles: [{}] }, 'en-US')).toBe('km');
  });
});
