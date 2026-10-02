import { describe, expect, test } from 'bun:test';
import { addDays, addMonths, daysAgo, daysUntil, formatSpan, fromLocalInput, inDays, parseYmd, relativeDay, toLocalInput, toYmd, HOUR } from './time';

const now = new Date(2031, 3, 15, 9, 30).getTime();

describe('months', () => {
  test.each([
    ['2031-01-31', 1, '2031-02-28'],
    ['2032-01-31', 1, '2032-02-29'],
    ['2031-08-31', 6, '2032-02-29'],
    ['2031-03-15', 12, '2032-03-15'],
    ['2031-11-30', 3, '2032-02-29'],
    ['2031-05-10', -6, '2030-11-10'],
  ])('%s plus %p months is %s', (from, n, to) => expect(addMonths(from, n)).toBe(to));
});

describe('spans', () => {
  test.each([
    [0, '0 days'],
    [1, '1 day'],
    [12, '12 days'],
    [14, '2 weeks'],
    [23, '3 weeks'],
    [60, '8 weeks'],
    [61, '2 months'],
    [96, '3 months'],
    [364, '11 months'],
    [729, '23 months'],
    [800, '2 years'],
    [-18, '2 weeks'],
  ])('%p days reads %s', (d, text) => expect(formatSpan(d)).toBe(text));

  test('in and ago', () => {
    expect(inDays(0)).toBe('today');
    expect(inDays(1)).toBe('tomorrow');
    expect(inDays(12)).toBe('in 12 days');
    expect(daysAgo(1)).toBe('yesterday');
    expect(daysAgo(4)).toBe('4 days ago');
  });
});

describe('dates', () => {
  test('YYYY-MM-DD round trip in local time, impossible days rejected', () => {
    expect(toYmd(parseYmd('2031-03-05')!)).toBe('2031-03-05');
    expect(parseYmd('2031-02-30')).toBeNull();
    expect(parseYmd('2031-3-5')).toBeNull();
    expect(parseYmd(undefined)).toBeNull();
  });

  test('days until a calendar day', () => {
    expect(daysUntil('2031-04-27', now)).toBe(12);
    expect(daysUntil('2031-04-15', now)).toBe(0);
    expect(daysUntil('2031-04-11', now)).toBe(-4);
  });

  test('addDays lands on local midnight', () => {
    expect(toYmd(addDays(now, 1))).toBe('2031-04-16');
    expect(new Date(addDays(now, -1)).getHours()).toBe(0);
  });

  test('datetime-local inputs', () => {
    expect(toLocalInput(now)).toBe('2031-04-15T09:30');
    expect(fromLocalInput('2031-04-15T09:30')).toBe(now);
    expect(fromLocalInput('')).toBeNull();
  });

  test.each([
    [0, 'Today'],
    [1, 'Tomorrow'],
    [-1, 'Yesterday'],
    [5, 'In 5 days'],
    [-12, '12 days ago'],
  ])('%p days is %s', (d, text) => expect(relativeDay(addDays(now, d) + 9 * HOUR, now)).toBe(text));
});
