// Calendar-day arithmetic and wording. Pure: every function takes `now` instead of reading the clock.

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

/** 'YYYY-MM-DD', a local calendar day. */
export type Ymd = string;

/** Local midnight at the start of the day containing `t`. */
export function startOfDay(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Local midnight `days` days after the day containing `t` (DST-safe). */
export function addDays(t: number, days: number): number {
  const d = new Date(startOfDay(t));
  d.setDate(d.getDate() + days);
  return d.getTime();
}

const YMD = /^(\d{4})-(\d{2})-(\d{2})$/;

/** 'YYYY-MM-DD' to local midnight, or null when malformed. */
export function parseYmd(ymd: string | undefined | null): number | null {
  if (!ymd) return null;
  const m = YMD.exec(ymd);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (d.getMonth() !== Number(m[2]) - 1) return null;
  return d.getTime();
}

export const isYmd = (s: string | undefined | null): s is Ymd => parseYmd(s) !== null;

export function toYmd(t: number): Ymd {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * The same day `months` months later. A day the target month lacks clamps to its last day:
 * 31 January plus one month is 28 (or 29) February.
 */
export function addMonths(ymd: Ymd, months: number): Ymd {
  const t = parseYmd(ymd);
  if (t === null) throw new Error(`Not a date: ${ymd}`);
  const d = new Date(t);
  const day = d.getDate();
  const target = new Date(d.getFullYear(), d.getMonth() + months, 1);
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(day, last));
  return toYmd(target.getTime());
}

/** Whole calendar days from the day of `from` to the day of `to` (negative when `to` is earlier). */
export function calendarDaysBetween(from: number, to: number): number {
  return Math.round((startOfDay(to) - startOfDay(from)) / DAY);
}

/** Days from today to a calendar day; negative once it has passed. */
export function daysUntil(ymd: Ymd, now: number): number {
  const t = parseYmd(ymd);
  if (t === null) throw new Error(`Not a date: ${ymd}`);
  return calendarDaysBetween(now, t);
}

const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'}`;

/**
 * A length of time in the unit a person would say: "5 days" under two weeks, "3 weeks" under two
 * months, "4 months" under two years, then years. Rounds down, so "3 weeks" never means 20 days.
 */
export function formatSpan(days: number): string {
  const d = Math.abs(Math.trunc(days));
  if (d < 14) return plural(d, 'day');
  if (d < 61) return plural(Math.floor(d / 7), 'week');
  if (d < 730) return plural(Math.floor(d / 30.44), 'month');
  return plural(Math.floor(d / 365.25), 'year');
}

/** "today", "tomorrow", "in 12 days", "in 3 weeks". */
export function inDays(days: number): string {
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  return `in ${formatSpan(days)}`;
}

/** "today", "yesterday", "4 days ago", "2 months ago". */
export function daysAgo(days: number): string {
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${formatSpan(days)} ago`;
}

/** "Today", "Tomorrow", "In 5 days", "Yesterday", "12 days ago", by calendar day. */
export function relativeDay(t: number, now: number): string {
  const d = calendarDaysBetween(now, t);
  if (d === 0) return 'Today';
  if (d === 1) return 'Tomorrow';
  if (d === -1) return 'Yesterday';
  return d > 0 ? `In ${d} days` : `${-d} days ago`;
}

/** Value for <input type="datetime-local">, in local time. */
export function toLocalInput(t: number): string {
  const d = new Date(t);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function fromLocalInput(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? null : Math.round(t);
}
