import { describe, expect, test } from 'bun:test';
import fixture from './__fixtures__/service-due.json';
import { afterVisit, describeInterval, describeLast, dueText, serviceDue } from './schedule';

const now = new Date(fixture.now).getTime();

describe('next due by time or distance, whichever comes first', () => {
  for (const c of fixture.cases) {
    test(c.label, () => {
      const due = serviceDue(c.item, fixture.latest, fixture.pace, now);
      expect(due.state).toBe(c.state as typeof due.state);
      expect(due.daysLeft).toBe(c.daysLeft);
      expect(due.distanceLeft).toBe(c.distanceLeft);
      expect(dueText('Oil change', due, 'mi')).toBe(c.text);
    });
  }

  test('without any odometer reading, only time counts', () => {
    const due = serviceDue({ everyMonths: 6, everyDistance: 5000, lastDate: '2031-01-10', lastOdometer: 38000 }, null, null, now);
    expect(due.distanceLeft).toBeNull();
    expect(dueText('Oil change', due, 'mi')).toBe('Oil change due in 2 months');
  });

  test('without a pace, distance-only has no estimate', () => {
    const due = serviceDue({ everyDistance: 5000, lastOdometer: 38000 }, fixture.latest, null, now);
    expect(dueText('Tire rotation', due, 'mi')).toBe('Tire rotation due in 1,600 miles');
  });

  test('overdue sorts before due today, which sorts before later', () => {
    const over = serviceDue({ everyDistance: 3000, lastOdometer: 38000 }, fixture.latest, fixture.pace, now);
    const today = serviceDue({ everyMonths: 12, lastDate: '2030-04-15' }, fixture.latest, fixture.pace, now);
    const later = serviceDue({ everyMonths: 12, lastDate: '2030-09-01' }, fixture.latest, fixture.pace, now);
    expect(over.sortDays).toBeLessThan(today.sortDays);
    expect(today.sortDays).toBeLessThan(later.sortDays);
  });

  test('kilometres', () => {
    const due = serviceDue({ everyMonths: 6, everyDistance: 8000, lastDate: '2030-11-08', lastOdometer: 33000 }, fixture.latest, null, now);
    expect(dueText('Oil change', due, 'km')).toBe('Oil change overdue by 400 kilometres');
  });
});

describe('wording', () => {
  test.each([
    [{ everyMonths: 6, everyDistance: 5000 }, 'Every 6 months or 5,000 miles'],
    [{ everyMonths: 12 }, 'Every year'],
    [{ everyMonths: 24 }, 'Every 2 years'],
    [{ everyMonths: 1 }, 'Every month'],
    [{ everyDistance: 7500 }, 'Every 7,500 miles'],
    [{}, 'No schedule'],
  ])('%p', (item, text) => expect(describeInterval(item, 'mi')).toBe(text));

  test('last done', () => {
    expect(describeLast({ lastDate: '2031-01-20', lastOdometer: 38600 }, 'mi', now)).toBe('Last done 2 months ago at 38,600 miles');
    expect(describeLast({ lastDate: '2031-04-15' }, 'mi', now)).toBe('Last done today');
    expect(describeLast({ lastOdometer: 1 }, 'mi', now)).toBe('Last done at 1 mile');
    expect(describeLast({}, 'mi', now)).toBeNull();
  });
});

describe('a service visit moves the schedule forward', () => {
  test('sets the date and mileage', () => {
    expect(afterVisit({ lastDate: '2030-11-08', lastOdometer: 37000 }, '2031-04-15', 41500)).toEqual({ lastDate: '2031-04-15', lastOdometer: 41500 });
  });

  test('without a mileage, keeps no stale one', () => {
    expect(afterVisit({ lastDate: '2030-11-08', lastOdometer: 37000 }, '2031-04-15', undefined)).toEqual({ lastDate: '2031-04-15' });
  });

  test('an older visit leaves a newer record alone', () => {
    expect(afterVisit({ lastDate: '2031-02-01', lastOdometer: 39000 }, '2031-01-15', 38500)).toBeNull();
  });
});
