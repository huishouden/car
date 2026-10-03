import type { Contact, ContactInput } from '@huishouden/pwa-kit/contacts';
import type { Role } from '@huishouden/pwa-kit/roles';
import type { DistanceUnit } from '../lib/distance';
import type { CarData } from '../lib/demo';
import type { AppointmentData, OdometerData, RenewalData, ServiceItemData, ServiceLogData, VehicleData } from '../lib/model';

export type { CarData };

type Input<T> = Omit<T, 'createdAt' | 'updatedAt' | 'by'>;
export type VehicleInput = Input<VehicleData>;
export type ServiceItemInput = Input<ServiceItemData>;
export type ReadingInput = Input<OdometerData>;
export type RenewalInput = Input<RenewalData>;
export type VisitInput = Input<ServiceLogData>;
export type AppointmentInput = Input<AppointmentData>;

/** Puts back what an action changed. Every action that changes data returns one, for the toast's Undo. */
export type { Undo } from '@huishouden/pwa-kit/store';
import type { Undo } from '@huishouden/pwa-kit/store';

/** Writes return at once (Firestore queues them offline); failures arrive through the store's onError. */
export interface CarActions {
  setDistanceUnit(unit: DistanceUnit): void;
  /** A new car can start with the usual schedule (oil change, tire rotation, inspection, wiper blades). */
  saveVehicle(id: string | null, input: VehicleInput, options?: { defaultSchedule?: boolean }): { id: string; undo: Undo };
  /** Deletes the car with its schedule, readings, renewals, history and appointments. */
  deleteVehicle(id: string): Undo;
  saveServiceItem(id: string | null, input: ServiceItemInput): Undo;
  deleteServiceItem(id: string): Undo;
  logReading(input: ReadingInput): Undo;
  deleteReading(id: string): Undo;
  saveRenewal(id: string | null, input: RenewalInput): Undo;
  /** Moves a repeating renewal to its next due date. */
  markRenewed(id: string): Undo;
  deleteRenewal(id: string): Undo;
  /** Saves a visit and moves the schedule items it covered forward. */
  saveVisit(id: string | null, input: VisitInput): Undo;
  deleteVisit(id: string): Undo;
  saveAppointment(id: string | null, input: AppointmentInput): Undo;
  deleteAppointment(id: string): Undo;
  saveContact(id: string | null, input: ContactInput): void;
  deleteContact(id: string): void;
  /** Puts a deleted shop back under its old id, so visits and appointments that point at it still do. */
  restoreContact(c: Contact): void;
}

export interface CarStore {
  data: CarData;
  /** False until every collection has answered once (from cache or server). */
  ready: boolean;
  actions: CarActions;
  /** The signed-in member's email (or the demo's). */
  me: string;
  /** Their role in the household (the demo's member is an admin). */
  role: Role | null;
}
