// Odometer distances in the household's unit. Readings are stored as entered, in that unit.

export type DistanceUnit = 'mi' | 'km';

export const UNIT_NAMES: Record<DistanceUnit, { one: string; many: string; label: string }> = {
  mi: { one: 'mile', many: 'miles', label: 'Miles' },
  km: { one: 'kilometre', many: 'kilometres', label: 'Kilometres' },
};

const grouped = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

/** "42,180 miles", "1 mile", "600 km" style wording with the unit spelled out: "600 kilometres". */
export function formatDistance(value: number, unit: DistanceUnit): string {
  const n = Math.round(Math.abs(value));
  const names = UNIT_NAMES[unit];
  return `${grouped.format(n)} ${n === 1 ? names.one : names.many}`;
}

/** The number alone, grouped: "42,180". */
export const formatReading = (value: number) => grouped.format(Math.round(value));

/** "42,180", "42180", "42 180" → 42180; anything else → null. */
export function parseReading(text: string): number | null {
  const t = text.replace(/[\s,._]/g, '');
  if (!/^\d{1,7}$/.test(t)) return null;
  return Number(t);
}

/** Usual service intervals: the default schedule writes these in the household's unit. */
export function defaultDistance(miles: number, unit: DistanceUnit): number {
  if (unit === 'mi') return miles;
  // Rounded to the nearest 1,000 km, as service books print them.
  return Math.round((miles * 1.609344) / 1000) * 1000;
}
