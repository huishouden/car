import type { Contact, ContactInput } from '@huishouden/pwa-kit/contacts';
import { homePoint } from '@huishouden/pwa-kit/home';
import { searchPlaces, type NearPoint, type ParsedPlace, type Place } from '@huishouden/pwa-kit/places';
import type { ShopRole } from './contacts';

// Shops near home: kinds of place a car needs, found around the household's home on OpenStreetMap
// (the kit's `searchPlaces` with `near`), one search per tap.

export interface NearbyKind {
  id: 'mechanic' | 'tires' | 'carWash' | 'gas';
  /** What `searchPlaces` is asked, in English: it matches the kit's `PLACE_KINDS` words. */
  query: string;
  /** The role a shop found this way is saved with. */
  role: ShopRole;
}

export const NEARBY_KINDS: readonly NearbyKind[] = [
  { id: 'mechanic', query: 'car repair', role: 'mechanic' },
  { id: 'tires', query: 'tires', role: 'tires' },
  { id: 'carWash', query: 'car wash', role: 'carWash' },
  { id: 'gas', query: 'gas', role: 'gas' },
];

/** How far around home a kind search looks, in km. */
export const NEARBY_RADIUS_KM = 10;

/** Up to five places of this kind nearest home first, each with its `distanceKm`; none without a home. */
export async function findNearHome(
  kind: NearbyKind,
  { home = homePoint(), fetch }: { home?: NearPoint; fetch?: typeof globalThis.fetch } = {},
): Promise<Place[]> {
  if (!home) return [];
  return searchPlaces(kind.query, { near: home, radiusKm: NEARBY_RADIUS_KM, limit: 5, ...(fetch ? { fetch } : {}) });
}

/** A found place as a new shop's starting details, for the kit's `ContactDialog`. */
export function placePrefill(p: Place): ParsedPlace {
  return {
    name: p.name,
    ...(p.address ? { address: p.address } : {}),
    ...(p.phone ? { phone: p.phone } : {}),
    ...(p.website ? { website: p.website } : {}),
    mapsUrl: p.mapsUrl,
    ...(p.openingHours ? { hours: p.openingHours } : {}),
    confidence: 1,
    unparsed: [],
    ignored: [],
  };
}

/**
 * The saved shop with the found place's exact position, when it kept the place's address (so the
 * card says how far it is from home without looking the address up again).
 */
export function withPlacePosition(input: ContactInput, place: Place | undefined): ContactInput {
  if (!place || !place.address.trim() || input.address?.trim() !== place.address.trim()) return input;
  return { ...input, lat: place.lat, lng: place.lon };
}

const key = (s: string | undefined) => (s ?? '').trim().toLowerCase();

/** The household's shop this place already is: same name, and the same address when both have one. */
export function savedAs(place: Place, contacts: readonly Contact[]): Contact | undefined {
  return contacts.find((c) => key(c.name) === key(place.name) && (!c.address || !place.address || key(c.address) === key(place.address)));
}
