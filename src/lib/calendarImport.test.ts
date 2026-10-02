import { describe, expect, test } from 'bun:test';
import { calendarError, isImported, notImported, plainText, type CalendarMatch } from '@huishouden/pwa-kit/calendar';
import fixture from './__fixtures__/calendar-matches.json';
import { fromCalendar, guessVehicle } from './calendarImport';
import type { Appointment } from './model';
import { LIMITS } from './model';

const matches = fixture.matches as CalendarMatch[];
const [oil, tires, dmv] = matches;
const appt = (fields: Partial<Appointment>): Appointment => ({ id: 'a1', title: 'Something', at: 1, createdAt: 1, by: 'sam@example.com', ...fields });

describe('notes from a calendar description', () => {
  test('HTML becomes plain text with line breaks', () => {
    expect(plainText(oil.description)).toBe('Drop off before 8.\nAsk about the brakes & wipers.');
  });

  test('plain text passes through; long text is cut to the limit', () => {
    expect(plainText(dmv.description)).toBe('Line one\nLine two');
    const out = plainText('word '.repeat(400), LIMITS.appointmentNotes);
    expect(out.length).toBeLessThanOrEqual(LIMITS.appointmentNotes);
    expect(out.endsWith('…')).toBe(true);
  });
});

describe('an appointment from a calendar event', () => {
  test('fills title, time, place, notes and the event link', () => {
    expect(fromCalendar(oil)).toEqual({
      title: 'Oil change - family van',
      at: oil.start,
      location: 'Example Auto Service, 18 Example Street, Springfield',
      notes: 'Drop off before 8.\nAsk about the brakes & wipers.',
      calendarEventId: 'evt-oil-1',
      calendarLink: 'https://www.google.com/calendar/event?eid=evt-oil-1',
    });
  });

  test('leaves out an empty place and notes', () => {
    const out = fromCalendar(tires);
    expect('location' in out).toBe(false);
    expect('notes' in out).toBe(false);
  });
});

describe('import de-duplication', () => {
  test('by id, by link, or by the same title at the same time', () => {
    expect(isImported(oil, [appt({ calendarEventId: 'evt-oil-1' })])).toBe(true);
    expect(isImported(oil, [appt({ calendarLink: oil.link })])).toBe(true);
    expect(isImported(oil, [appt({ title: ' OIL CHANGE - family van', at: oil.start })])).toBe(true);
    expect(isImported(oil, [appt({ title: 'Oil change - family van', at: oil.start + 60_000 })])).toBe(false);
  });

  test('lists each new event once, soonest first', () => {
    expect(notImported(matches, []).map((m) => m.id)).toEqual(['evt-dmv', 'evt-oil-1', 'evt-tires']);
    expect(notImported(matches, [appt({ calendarEventId: 'evt-dmv' })]).map((m) => m.id)).toEqual(['evt-oil-1', 'evt-tires']);
  });
});

describe('which car an event is about', () => {
  const cars = [
    { id: 'v1', name: 'Family van' },
    { id: 'v2', name: 'Commuter' },
  ];
  test('the one car named in it', () => {
    expect(guessVehicle(oil, cars)).toBe('v1');
    expect(guessVehicle(tires, cars)).toBeUndefined();
  });
  test('the only car', () => {
    expect(guessVehicle(tires, [cars[1]])).toBe('v2');
  });
});

test('a closed Google window reads as not allowed; anything else as a connection problem', () => {
  expect(calendarError({ code: 'auth/popup-closed-by-user' })).toContain('not allowed');
  expect(calendarError({ code: 'auth/popup-blocked' })).toContain('pop-ups');
  expect(calendarError(new Error('[500] Calendar: backend'))).toContain('connection');
});
