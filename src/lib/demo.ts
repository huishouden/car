import type { Contact } from '@huishouden/pwa-kit/contacts';
import type { Appointment, OdometerReading, Renewal, ServiceItem, ServiceLogEntry, SettingsData, Vehicle } from './model';
import { renewalLabel } from './model';
import { defaultDistance, localeUnit, type DistanceUnit } from './distance';
import { joinNames } from './words';
import { t } from '../i18n';

// Invented sample data for the signed-out app: README screenshots and first impressions. Dates
// sit in 2031, businesses are "Example" and "Sample" on example.com with 555-01xx numbers, and no
// car has a plate or VIN. Distances are in the page's locale's unit and the schedule's names in its
// language, as a household there would have entered them; the rest stays as written.

/** Tuesday 15 April 2031, 09:30 local time. The demo's clock starts here. */
export const DEMO_NOW = new Date(2031, 3, 15, 9, 30).getTime();

export const DEMO_MEMBERS = ['sam@example.com', 'alex@example.com'];
const [SAM, ALEX] = DEMO_MEMBERS;

export interface CarData {
  vehicles: Vehicle[];
  serviceItems: ServiceItem[];
  readings: OdometerReading[];
  renewals: Renewal[];
  serviceLog: ServiceLogEntry[];
  appointments: Appointment[];
  /** The household's contacts shown in Car. */
  contacts: Contact[];
  settings: SettingsData | null;
}

const created = new Date(2030, 2, 1, 12).getTime();
const stamp = (by = SAM) => ({ createdAt: created, by });
const at = (ymd: string, hhmm: string) => {
  const [y, m, d] = ymd.split('-').map(Number);
  const [h, min] = hhmm.split(':').map(Number);
  return new Date(y, m - 1, d, h, min).getTime();
};

const VAN = 'demo-car-van';
const COMMUTER = 'demo-car-commuter';
const AUTO = 'demo-shop-auto';
const TIRES = 'demo-shop-tires';
const DEALER = 'demo-shop-dealer';

export function demoData(unit: DistanceUnit = localeUnit()): CarData {
  /** A sample distance written in miles, in the sample's unit (readings to the nearest 10). */
  const d = (miles: number) => (unit === 'mi' ? miles : Math.round((miles * 1.609344) / 10) * 10);
  const every = (miles: number) => defaultDistance(miles, unit);
  const [oil, tires, inspection, wipers, cabin] = (['item.oil', 'item.tires', 'item.inspection', 'item.wipers', 'item.cabinFilter'] as const).map((k) => t(k));
  const vehicles: Vehicle[] = [
    { id: VAN, name: 'Family van', make: 'Toyota', model: 'Sienna', year: 2027, notes: 'Spare key in the kitchen drawer.', ...stamp() },
    { id: COMMUTER, name: 'Commuter', make: 'Honda', model: 'Civic', year: 2024, ...stamp(ALEX), createdAt: created + 60_000 },
  ];

  const item = (id: string, vehicleId: string, name: string, f: Partial<ServiceItem>): ServiceItem => ({ id, vehicleId, name, ...f, ...stamp() });
  const serviceItems: ServiceItem[] = [
    item('demo-item-van-oil', VAN, oil, { everyMonths: 6, everyDistance: every(5000), lastDate: '2030-11-08', lastOdometer: d(37000), notes: 'Synthetic 0W-20' }),
    item('demo-item-van-tires', VAN, tires, { everyMonths: 6, everyDistance: every(6000), lastDate: '2031-01-20', lastOdometer: d(38600) }),
    item('demo-item-van-inspection', VAN, inspection, { everyMonths: 12, lastDate: '2030-03-28', lastOdometer: d(26900) }),
    item('demo-item-van-wipers', VAN, wipers, { everyMonths: 12 }),
    item('demo-item-van-cabin', VAN, cabin, { everyMonths: 12, everyDistance: every(15000), lastDate: '2030-11-08', lastOdometer: d(37000) }),
    item('demo-item-commuter-oil', COMMUTER, oil, { everyMonths: 12, everyDistance: every(7500), lastDate: '2030-12-15', lastOdometer: d(16800) }),
    item('demo-item-commuter-tires', COMMUTER, tires, { everyDistance: every(7500), lastDate: '2030-12-15', lastOdometer: d(16800) }),
    item('demo-item-commuter-inspection', COMMUTER, inspection, { everyMonths: 12, lastDate: '2030-05-02', lastOdometer: d(11900) }),
    item('demo-item-commuter-wipers', COMMUTER, wipers, { everyMonths: 12, lastDate: '2031-02-11' }),
    // Paused over the winter: it would be overdue, but it doesn't come due until resumed.
    item('demo-item-commuter-wash', COMMUTER, 'Underbody wash', { everyMonths: 3, lastDate: '2030-11-20', pausedAt: new Date(2031, 0, 6, 18).getTime() }),
  ];

  const reading = (n: number, vehicleId: string, date: string, value: number, by = SAM): OdometerReading => ({
    id: `demo-reading-${n}`,
    vehicleId,
    date,
    reading: d(value),
    createdAt: at(date, '18:00'),
    by,
  });
  const readings: OdometerReading[] = [
    reading(1, VAN, '2030-04-20', 29200),
    reading(2, VAN, '2031-03-01', 40050, ALEX),
    reading(3, VAN, '2031-04-12', 41400),
    reading(4, COMMUTER, '2030-06-02', 12400, ALEX),
    reading(5, COMMUTER, '2031-04-05', 19750, ALEX),
  ];

  const renewal = (id: string, f: Omit<Renewal, 'id' | 'createdAt' | 'by'>): Renewal => ({ id, ...f, ...stamp() });
  const renewals: Renewal[] = [
    renewal('demo-renewal-van-registration', { vehicleId: VAN, kind: 'registration', name: renewalLabel('registration'), dueDate: '2031-04-27', everyMonths: 12 }),
    renewal('demo-renewal-commuter-registration', { vehicleId: COMMUTER, kind: 'registration', name: renewalLabel('registration'), dueDate: '2031-08-14', everyMonths: 12 }),
    renewal('demo-renewal-commuter-sticker', { vehicleId: COMMUTER, kind: 'inspection', name: renewalLabel('inspection'), dueDate: '2031-05-31', everyMonths: 12 }),
    renewal('demo-renewal-insurance', { kind: 'insurance', name: renewalLabel('insurance'), dueDate: '2031-06-01', everyMonths: 6, notes: 'Both cars on one policy.' }),
    renewal('demo-renewal-toll', { kind: 'toll', name: renewalLabel('toll'), dueDate: '2031-09-30', everyMonths: 12 }),
    // Handled without renewing: the permit ended when the commuter moved to the garage.
    renewal('demo-renewal-commuter-permit', { vehicleId: COMMUTER, kind: 'other', name: 'Street permit', dueDate: '2031-03-31', closedAt: new Date(2031, 2, 24, 19).getTime() }),
  ];

  const visit = (n: number, f: Omit<ServiceLogEntry, 'id' | 'createdAt' | 'by'>, by = SAM): ServiceLogEntry => ({
    id: `demo-visit-${n}`,
    ...f,
    ...(f.odometer !== undefined ? { odometer: d(f.odometer) } : {}),
    createdAt: at(f.date, '17:00'),
    by,
  });
  const serviceLog: ServiceLogEntry[] = [
    visit(1, { vehicleId: VAN, date: '2030-03-28', odometer: 26900, what: inspection, serviceItemIds: ['demo-item-van-inspection'], shopId: AUTO, costCents: 3500 }),
    visit(2, { vehicleId: COMMUTER, date: '2030-05-02', odometer: 11900, what: inspection, serviceItemIds: ['demo-item-commuter-inspection'], shopId: AUTO, costCents: 3500 }, ALEX),
    visit(3, {
      vehicleId: VAN,
      date: '2030-11-08',
      odometer: 37000,
      what: joinNames([oil, cabin]),
      serviceItemIds: ['demo-item-van-oil', 'demo-item-van-cabin'],
      shopId: AUTO,
      costCents: 11450,
      notes: 'Synthetic 0W-20. Front brakes have about a year left.',
    }),
    visit(4, { vehicleId: COMMUTER, date: '2030-12-15', odometer: 16800, what: joinNames([oil, tires]), serviceItemIds: ['demo-item-commuter-oil', 'demo-item-commuter-tires'], shopId: DEALER, costCents: 12995 }, ALEX),
    visit(5, { vehicleId: VAN, date: '2031-01-20', odometer: 38600, what: tires, serviceItemIds: ['demo-item-van-tires'], shopId: TIRES, costCents: 4000 }),
    visit(6, { vehicleId: COMMUTER, date: '2031-02-11', what: wipers, serviceItemIds: ['demo-item-commuter-wipers'], costCents: 3849, notes: 'Changed them ourselves.' }, ALEX),
  ];

  const appointments: Appointment[] = [
    {
      id: 'demo-appt-1',
      vehicleId: VAN,
      title: oil,
      at: at('2031-04-22', '08:00'),
      shopId: AUTO,
      location: '18 Example Street, Springfield',
      notes: 'Ask them to check the front brakes.',
      ...stamp(),
    },
    { id: 'demo-appt-2', vehicleId: COMMUTER, title: inspection, at: at('2031-04-29', '10:30'), shopId: AUTO, location: '18 Example Street, Springfield', ...stamp(ALEX) },
    { id: 'demo-appt-3', vehicleId: VAN, title: tires, at: at('2031-01-20', '09:00'), shopId: TIRES, location: '220 Demo Avenue, Springfield', ...stamp() },
  ];

  const shop = { apps: ['car'], createdAt: created, by: SAM };
  const contacts: Contact[] = [
    {
      id: AUTO,
      name: 'Example Auto Service',
      role: 'Mechanic',
      phone: '(555) 010-0164',
      website: 'https://autoservice.example.com',
      address: '18 Example Street, Springfield',
      notes: 'Free shuttle within 5 miles. Closed Sundays.',
      ...shop,
    },
    { id: TIRES, name: 'Sample Tire & Wheel', role: 'Tires', phone: '(555) 010-0128', address: '220 Demo Avenue, Springfield', ...shop },
    {
      id: DEALER,
      name: 'Demo Motors Service',
      role: 'Dealer',
      phone: '(555) 010-0191',
      email: 'service@motors.example.com',
      website: 'https://motors.example.com',
      address: '5 Sample Parkway, Springfield',
      ...shop,
    },
    { id: 'demo-shop-insurance', name: 'Example Insurance', role: 'Insurance', phone: '(555) 010-0150', website: 'https://insurance.example.com', notes: 'Policy covers both cars.', ...shop },
  ];

  return { vehicles, serviceItems, readings, renewals, serviceLog, appointments, contacts, settings: { distanceUnit: unit, updatedAt: created, updatedBy: SAM } };
}
