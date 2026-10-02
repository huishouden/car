import { describe, expect, test } from 'bun:test';
import fixture from './__fixtures__/renewals.json';
import type { RenewalKind } from './model';
import { nextRenewalDate, renewalDue, renewalText } from './renewals';

const now = new Date(fixture.now).getTime();

describe('renewal wording and state', () => {
  for (const c of fixture.cases) {
    test(c.text, () => {
      const r = { kind: c.kind as RenewalKind, name: c.name, dueDate: c.dueDate };
      expect(renewalText(r, now)).toBe(c.text);
      expect(renewalDue(r, now).state).toBe(c.state as 'ok');
    });
  }
});

describe('marking renewed', () => {
  test('moves on from the old due date, keeping the anniversary', () => {
    expect(nextRenewalDate({ dueDate: '2031-04-27', everyMonths: 12 }, now)).toBe('2032-04-27');
    expect(nextRenewalDate({ dueDate: '2031-06-01', everyMonths: 6 }, now)).toBe('2031-12-01');
  });

  test('renewed very late, it steps past today', () => {
    expect(nextRenewalDate({ dueDate: '2029-03-31', everyMonths: 12 }, now)).toBe('2032-03-31');
    expect(nextRenewalDate({ dueDate: '2031-01-31', everyMonths: 1 }, now)).toBe('2031-04-30');
  });

  test('a one-off has no next date', () => {
    expect(nextRenewalDate({ dueDate: '2031-04-27' }, now)).toBeNull();
  });
});
