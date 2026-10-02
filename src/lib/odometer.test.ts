import { describe, expect, test } from 'bun:test';
import { dailyPace, latestReading } from './odometer';

describe('latest reading', () => {
  test('latest date wins; on one day, the higher reading', () => {
    expect(
      latestReading([
        { date: '2031-03-01', reading: 40050 },
        { date: '2031-04-12', reading: 41400 },
        { date: '2031-04-12', reading: 41380 },
        { date: '2030-04-20', reading: 29200 },
      ]),
    ).toEqual({ date: '2031-04-12', reading: 41400 });
  });

  test('none, or only malformed dates', () => {
    expect(latestReading([])).toBeNull();
    expect(latestReading([{ date: 'soon', reading: 5 }])).toBeNull();
  });
});

describe('pace', () => {
  test('distance per day from the oldest point within a year', () => {
    const pace = dailyPace([
      { date: '2029-01-01', reading: 1000 },
      { date: '2030-04-20', reading: 29200 },
      { date: '2031-04-12', reading: 41400 },
    ]);
    expect(pace).toBeCloseTo(12200 / 357, 6);
  });

  test('needs two points at least two weeks apart that moved forward', () => {
    expect(dailyPace([{ date: '2031-04-12', reading: 41400 }])).toBeNull();
    expect(dailyPace([{ date: '2031-04-01', reading: 41000 }, { date: '2031-04-12', reading: 41400 }])).toBeNull();
    expect(dailyPace([{ date: '2031-01-01', reading: 41400 }, { date: '2031-04-12', reading: 41400 }])).toBeNull();
  });
});
