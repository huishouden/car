// Display formatting in the device's locale. Kept apart from time.ts, whose output tests pin down.

export const formatTime = (t: number) => new Date(t).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

export const formatDayLong = (t: number) => new Date(t).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

export const formatDateLong = (t: number) =>
  new Date(t).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

export const formatDayShort = (t: number) => new Date(t).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

export const monthShort = (t: number) => new Date(t).toLocaleDateString(undefined, { month: 'short' });

/** "Tue 22 Apr 2031" style day for a 'YYYY-MM-DD' date, in the device's locale. */
export const formatYmd = (ymd: string, options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }) => {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, options);
};
