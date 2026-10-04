import { getLocale } from '@huishouden/pwa-kit/i18n';
import { usesMiles } from '@huishouden/pwa-kit/places';

// Odometer distances in the household's unit. Readings are stored as entered, in that unit.

export type DistanceUnit = 'mi' | 'km';

const INTL_UNIT = { mi: 'mile', km: 'kilometer' } as const satisfies Record<DistanceUnit, string>;

/** The unit the page's locale reads distances in: miles in the US and the UK, kilometres elsewhere. */
export const localeUnit = (locale: string = getLocale()): DistanceUnit => (usesMiles(locale) ? 'mi' : 'km');

/**
 * The household's unit: as set; otherwise miles where cars were added before the choice existed
 * (their readings were entered in miles), and the locale's unit for a household with no cars yet.
 */
export function householdUnit(data: { settings: { distanceUnit: DistanceUnit } | null; vehicles: unknown[] }, locale: string = getLocale()): DistanceUnit {
  return data.settings?.distanceUnit ?? (data.vehicles.length ? 'mi' : localeUnit(locale));
}

const unitFormat = (unit: DistanceUnit, locale: string) =>
  new Intl.NumberFormat(locale, { style: 'unit', unit: INTL_UNIT[unit], unitDisplay: 'long', maximumFractionDigits: 0 });

/** "42,180 miles", "1 mile", "600 kilometers", "42.180 millas", "600 kilometer". */
export function formatDistance(value: number, unit: DistanceUnit, locale: string = getLocale()): string {
  return unitFormat(unit, locale).format(Math.round(Math.abs(value)));
}

/** The unit's word for many, in the page's language: "miles", "kilómetros", "mijl". */
export function unitWord(unit: DistanceUnit, locale: string = getLocale()): string {
  return unitFormat(unit, locale).formatToParts(2).find((p) => p.type === 'unit')?.value ?? unit;
}

/** The number alone, grouped the locale's way: "42,180", "42.180". */
export const formatReading = (value: number, locale: string = getLocale()) => new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(Math.round(value));

/** "42,180", "42.180", "42180", "42 180" → 42180; anything else → null. Readings are whole numbers. */
export function parseReading(text: string): number | null {
  const t = text.replace(/[\s,._  ']/g, '');
  if (!/^\d{1,7}$/.test(t)) return null;
  return Number(t);
}

/** Usual service intervals: the default schedule writes these in the household's unit. */
export function defaultDistance(miles: number, unit: DistanceUnit): number {
  if (unit === 'mi') return miles;
  // Rounded to the nearest 1,000 km, as service books print them.
  return Math.round((miles * 1.609344) / 1000) * 1000;
}
