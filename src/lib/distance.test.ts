import { describe, expect, test } from 'bun:test';
import { defaultDistance, formatDistance, formatReading, parseReading } from './distance';

describe('distance', () => {
  test.each([
    [42180, 'mi', '42,180 miles'],
    [1, 'mi', '1 mile'],
    [600, 'km', '600 kilometres'],
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

  test('default intervals in kilometres round to the nearest thousand', () => {
    expect(defaultDistance(5000, 'mi')).toBe(5000);
    expect(defaultDistance(5000, 'km')).toBe(8000);
    expect(defaultDistance(6000, 'km')).toBe(10000);
  });
});
