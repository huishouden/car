import { plainText, type CalendarMatch } from '@huishouden/pwa-kit/calendar';
import { LIMITS } from './model';

/** What Import from calendar looks for: the words car appointments tend to carry. */
export const CAR_CALENDAR_QUERIES = [
  'oil change',
  'car service',
  'service',
  'dealer',
  'tires',
  'tire rotation',
  'inspection',
  'registration',
  'mechanic',
  'car wash',
  'emissions',
];

/** The appointment fields a calendar event fills in. */
export function fromCalendar(m: CalendarMatch): { title: string; at: number; location?: string; notes?: string; calendarEventId: string; calendarLink: string } {
  const notes = plainText(m.description ?? '', LIMITS.appointmentNotes);
  const location = m.location?.trim().slice(0, LIMITS.location);
  return {
    title: m.title.trim().slice(0, LIMITS.title),
    at: m.start,
    ...(location ? { location } : {}),
    ...(notes ? { notes } : {}),
    calendarEventId: m.id,
    calendarLink: m.link,
  };
}

/** The car a calendar event is about: the only car, or the one car whose nickname it mentions. */
export function guessVehicle(m: Pick<CalendarMatch, 'title' | 'description' | 'location'>, vehicles: { id: string; name: string }[]): string | undefined {
  if (vehicles.length === 1) return vehicles[0].id;
  const text = `${m.title} ${m.description} ${m.location}`.toLowerCase();
  const hits = vehicles.filter((v) => v.name.trim() && text.includes(v.name.trim().toLowerCase()));
  return hits.length === 1 ? hits[0].id : undefined;
}
