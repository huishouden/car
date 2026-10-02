import type { CalendarMatch } from '@huishouden/pwa-kit/calendar';
import type { Appointment } from './model';
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

/** Calendar descriptions often arrive as HTML; notes are plain text within the rules' limit. */
export function plainText(description: string, max: number = LIMITS.appointmentNotes): string {
  const text = description
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

/** The appointment fields a calendar event fills in. */
export function fromCalendar(m: CalendarMatch): { title: string; at: number; location?: string; notes?: string; calendarEventId: string; calendarLink: string } {
  const notes = plainText(m.description ?? '');
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

const sameTitle = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Whether an appointment already stands for this calendar event. */
export function isImported(m: CalendarMatch, appointments: Appointment[]): boolean {
  return appointments.some(
    (a) => (a.calendarEventId && a.calendarEventId === m.id) || (a.calendarLink && a.calendarLink === m.link) || (a.at === m.start && sameTitle(a.title, m.title)),
  );
}

/** Calendar events not yet in Car, each once, soonest first. */
export function notImported(matches: CalendarMatch[], appointments: Appointment[]): CalendarMatch[] {
  const seen = new Set<string>();
  return matches
    .filter((m) => {
      if (seen.has(m.id) || isImported(m, appointments)) return false;
      seen.add(m.id);
      return true;
    })
    .sort((a, b) => a.start - b.start);
}

/** A readable reason for a failed calendar search; every case offers Try again. */
export function calendarError(e: unknown): string {
  const code = (e as { code?: string })?.code;
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request' || code === 'auth/user-cancelled')
    return 'Calendar access was not allowed. Try again when you are ready.';
  if (code === 'auth/popup-blocked') return 'The browser blocked the Google window. Allow pop-ups for this site and try again.';
  return "Couldn't search your calendar. Check the connection and try again.";
}

/** The car a calendar event is about: the only car, or the one car whose nickname it mentions. */
export function guessVehicle(m: Pick<CalendarMatch, 'title' | 'description' | 'location'>, vehicles: { id: string; name: string }[]): string | undefined {
  if (vehicles.length === 1) return vehicles[0].id;
  const text = `${m.title} ${m.description} ${m.location}`.toLowerCase();
  const hits = vehicles.filter((v) => v.name.trim() && text.includes(v.name.trim().toLowerCase()));
  return hits.length === 1 ? hits[0].id : undefined;
}
