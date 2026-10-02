import { describe, expect, test } from 'bun:test';
import { defaultDistance, formatDistance, formatReading, parseReading } from './distance';
import { centsInput, formatCents, parseMoney } from './money';

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

describe('money', () => {
  test('cents to dollars', () => {
    expect(formatCents(8999)).toBe('$89.99');
    expect(formatCents(123450)).toBe('$1,234.50');
    expect(formatCents(123450, { headline: true })).toBe('$1,235');
  });

  test.each([
    ['89.99', 8999],
    ['$1,234.5', 123450],
    ['40', 4000],
    ['0.05', 5],
    ['', undefined],
    ['   ', undefined],
    ['abc', null],
    ['1.234', null],
    ['-5', null],
  ])('%p', (text, cents) => expect(parseMoney(text)).toBe(cents as number));

  test('editing shows two decimals', () => {
    expect(centsInput(8999)).toBe('89.99');
    expect(centsInput(4000)).toBe('40.00');
    expect(centsInput(undefined)).toBe('');
  });
});
