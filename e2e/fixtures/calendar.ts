import type { CalendarMatch } from '@huishouden/pwa-kit/calendar';

// Invented events around the sample household's 2031 dates, standing in for Google Calendar.
const at = (month: number, day: number, h: number, m = 0) => new Date(2031, month - 1, day, h, m).getTime();

export const calendarEvents: CalendarMatch[] = [
  {
    id: 'evt-tires',
    title: 'Tire rotation - Commuter',
    start: at(5, 6, 8, 30),
    end: at(5, 6, 9, 30),
    allDay: false,
    location: 'Sample Tire & Wheel, 220 Demo Avenue, Springfield',
    description: '<p>Ask about the front tires.</p>',
    link: 'https://calendar.example.com/event?eid=evt-tires',
    calendarName: 'Family',
  },
  {
    id: 'evt-registration',
    title: 'Registration renewal',
    start: at(4, 24, 0, 0),
    allDay: true,
    location: '',
    description: '',
    link: 'https://calendar.example.com/event?eid=evt-registration',
    calendarName: 'Sam',
  },
  {
    id: 'evt-wash',
    title: 'Car wash',
    start: at(5, 10, 11, 0),
    allDay: false,
    location: 'Example Car Wash',
    description: '',
    link: 'https://calendar.example.com/event?eid=evt-wash',
    calendarName: 'Alex',
  },
  // Already in the sample appointments (same title and time), so the import leaves it out.
  {
    id: 'evt-oil',
    title: 'Oil change',
    start: at(4, 22, 8, 0),
    allDay: false,
    location: '18 Example Street, Springfield',
    description: '',
    link: 'https://calendar.example.com/event?eid=evt-oil',
    calendarName: 'Family',
  },
];

/** Run before the page loads: the app then treats the browser as able to read a calendar. */
export function mockCalendar(events: CalendarMatch[]) {
  (window as unknown as { __mockCalendarEvents: CalendarMatch[] }).__mockCalendarEvents = events;
}
