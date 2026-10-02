import type { DistanceUnit } from './distance';
import type { Ymd } from '@huishouden/pwa-kit/time';

// Firestore shapes under households/{householdId}. The project's rules accept exactly these keys,
// so writers build documents from these types (data/build.ts) and never add fields.

interface Stamp {
  createdAt: number;
  updatedAt?: number;
  /** Lowercase email of whoever created it (kept when someone else edits). */
  by: string;
}

/** carVehicles/{id}. Never a plate or VIN: the household knows its own cars by nickname. */
export interface VehicleData extends Stamp {
  name: string;
  make?: string;
  model?: string;
  year?: number;
  notes?: string;
}

/** carServiceItems/{id}: something done every N months and/or every N miles. */
export interface ServiceItemData extends Stamp {
  vehicleId: string;
  name: string;
  everyMonths?: number;
  everyDistance?: number;
  lastDate?: Ymd;
  lastOdometer?: number;
  notes?: string;
}

/** carOdometer/{id} */
export interface OdometerData extends Stamp {
  vehicleId: string;
  date: Ymd;
  reading: number;
  note?: string;
}

export const RENEWAL_KINDS = ['registration', 'insurance', 'inspection', 'toll', 'other'] as const;
export type RenewalKind = (typeof RENEWAL_KINDS)[number];

/** carRenewals/{id}. No vehicleId: it covers every car (a toll account, a multi-car policy). */
export interface RenewalData extends Stamp {
  vehicleId?: string;
  kind: RenewalKind;
  name: string;
  dueDate: Ymd;
  everyMonths?: number;
  notes?: string;
}

/** carServiceLog/{id}: one visit, which may cover several schedule items. */
export interface ServiceLogData extends Stamp {
  vehicleId: string;
  date: Ymd;
  odometer?: number;
  what: string;
  serviceItemIds?: string[];
  /** The shop: a household contact (households/{id}/contacts). */
  shopId?: string;
  costCents?: number;
  notes?: string;
}

/** carAppointments/{id} */
export interface AppointmentData extends Stamp {
  vehicleId?: string;
  title: string;
  at: number;
  location?: string;
  notes?: string;
  shopId?: string;
  /** The Google Calendar event it came from, so an import never adds it twice. */
  calendarEventId?: string;
  calendarLink?: string;
}

/** carSettings/main */
export interface SettingsData {
  distanceUnit: DistanceUnit;
  updatedAt: number;
  updatedBy: string;
}

type WithId<T> = T & { id: string };
export type Vehicle = WithId<VehicleData>;
export type ServiceItem = WithId<ServiceItemData>;
export type OdometerReading = WithId<OdometerData>;
export type Renewal = WithId<RenewalData>;
export type ServiceLogEntry = WithId<ServiceLogData>;
export type Appointment = WithId<AppointmentData>;

/** Field limits, mirrored in the rules. */
export const LIMITS = {
  vehicleName: 60,
  make: 40,
  model: 40,
  vehicleNotes: 500,
  itemName: 80,
  itemNotes: 500,
  readingNote: 200,
  renewalName: 80,
  renewalNotes: 500,
  what: 120,
  logNotes: 1000,
  title: 120,
  location: 200,
  appointmentNotes: 500,
  maxReading: 9_999_999,
  maxEveryMonths: 240,
  maxRenewalMonths: 120,
  maxEveryDistance: 1_000_000,
  maxCostCents: 100_000_000,
  minYear: 1900,
  maxYear: 2100,
} as const;

export const RENEWAL_LABELS: Record<RenewalKind, string> = {
  registration: 'Registration',
  insurance: 'Insurance',
  inspection: 'Inspection sticker',
  toll: 'Toll account',
  other: 'Other',
};
