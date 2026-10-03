import { CalendarCheck, CalendarClock, CarFront, History as HistoryIcon, LayoutDashboard, Store } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import type { User } from 'firebase/auth';
import type { Contact } from '@huishouden/pwa-kit/contacts';
import type { Appointment, Renewal, ServiceItem, ServiceLogEntry, Vehicle } from './lib/model';
import type { DistanceUnit } from './lib/distance';
import { formatYmd } from '@huishouden/pwa-kit/time';
import { carOdometer } from './lib/upcoming';
import { useClock } from '@huishouden/pwa-kit/react/clock';
import type { CarStore, VisitInput } from './data/types';
import { CalendarSuggestions, calendarAvailable, useCalendarSuggestions } from '@huishouden/pwa-kit/react/calendar';
import { isImported, type CalendarMatch } from '@huishouden/pwa-kit/calendar';
import { CAR_CALENDAR_QUERIES, fromCalendar, guessVehicle } from './lib/calendarImport';
import { auth } from './data/firebase';
import { Header, type Tab } from './components/Header';
import { Toast, type ToastState } from '@huishouden/pwa-kit/react/ui';
import { VehicleDialog } from './components/VehicleDialog';
import { ServiceItemDialog } from './components/ServiceItemDialog';
import { ReadingDialog } from './components/ReadingDialog';
import { RenewalDialog } from './components/RenewalDialog';
import { VisitDialog } from './components/VisitDialog';
import { AppointmentDialog } from './components/AppointmentDialog';
import { ContactDialog } from '@huishouden/pwa-kit/react/contacts';
import { mayFor, type May } from './lib/may';

export type { May };
import { APP, ROLES } from './lib/contacts';
import { Overview } from './screens/Overview';
import { Cars } from './screens/Cars';
import { Renewals } from './screens/Renewals';
import { History } from './screens/History';
import { Appointments } from './screens/Appointments';
import { Shops } from './screens/Shops';

export type TabId = 'overview' | 'cars' | 'renewals' | 'history' | 'appointments' | 'shops';

// On phones the four primaries sit in the bottom bar (what is due, then what is booked and done);
// the cars' details and the shops are under More.
const TABS: (Tab & { id: TabId })[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard, primary: true },
  { id: 'cars', label: 'Cars', icon: CarFront },
  { id: 'renewals', label: 'Renewals', icon: CalendarClock, primary: true },
  { id: 'history', label: 'History', icon: HistoryIcon, primary: true },
  { id: 'appointments', label: 'Appointments', short: 'Bookings', icon: CalendarCheck, primary: true },
  { id: 'shops', label: 'Shops', icon: Store },
];

/** Which dialog is open, and what it was opened with. */
export type Open =
  | { kind: 'vehicle'; vehicle: Vehicle | null }
  | { kind: 'item'; vehicleId: string; item: ServiceItem | null }
  | { kind: 'reading'; vehicleId: string }
  | { kind: 'renewal'; renewal: Renewal | null; vehicleId?: string }
  | { kind: 'visit'; visit: ServiceLogEntry | null; prefill?: Partial<VisitInput> }
  | { kind: 'appointment'; appointment: Appointment | null; vehicleId?: string }
  | { kind: 'contact'; contact: Contact | null };

export type Notify = (message: string, undo?: () => void) => void;

/** What every screen gets: the store, the unit, what the role allows, and ways to open dialogs and say what happened. */
export interface ScreenProps {
  store: CarStore;
  unit: DistanceUnit;
  may: May;
  open: (o: Open) => void;
  notify: Notify;
}

interface Props {
  store: CarStore;
  user: User | null;
  onSignIn: () => void;
  onSignOut: () => void;
  signingIn: boolean;
  toast: ToastState | null;
  notify: Notify;
  clearToast: () => void;
  /** Shown above the content: the sample-data banner. */
  banner?: ReactNode;
}

/** Everything inside the frame once there is data to show (live or sample). */
export function CarApp({ store, user, onSignIn, onSignOut, signingIn, toast, notify, clearToast, banner }: Props) {
  const { now } = useClock();
  const [tab, setTab] = useState<TabId>('overview');
  const [carId, setCarId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Open | null>(null);
  const { data, actions } = store;
  const unit: DistanceUnit = data.settings?.distanceUnit ?? 'mi';
  const calendar = calendarAvailable(user);
  const suggested = useCalendarSuggestions({ auth, words: CAR_CALENDAR_QUERIES, isImported: (m) => isImported(m, data.appointments), app: 'Car' });

  /** Calendar events in as appointments, with the car guessed: Import from calendar and the new-in-your-calendar card. */
  const importEvents = (list: CalendarMatch[]) => {
    const undos = list.map((m) => actions.saveAppointment(null, { ...fromCalendar(m), vehicleId: guessVehicle(m, data.vehicles) }));
    notify(list.length === 1 ? `Added ${list[0].title}` : `Added ${list.length} appointments`, () => undos.forEach((u) => u()));
  };
  const close = () => setDialog(null);

  useEffect(() => {
    document.title = 'Huishouden Car';
  }, []);

  const may = mayFor(store);
  const screen: ScreenProps = { store, unit, may, open: setDialog, notify };
  const showCar = (id: string) => {
    setCarId(id);
    setTab('cars');
  };

  let content: ReactNode;
  if (!store.ready) content = <p className="p-2 text-lg text-stone-600">Loading the cars</p>;
  else if (tab === 'cars') content = <Cars {...screen} carId={carId} onCar={setCarId} />;
  else if (tab === 'renewals') content = <Renewals {...screen} />;
  else if (tab === 'history') content = <History {...screen} />;
  else if (tab === 'appointments') content = <Appointments {...screen} calendarAvailable={calendar} onImport={importEvents} />;
  else if (tab === 'shops') content = <Shops {...screen} />;
  else content = <Overview {...screen} onCar={showCar} onOpen={setTab} />;

  const vehicleName = (id: string | undefined) => data.vehicles.find((v) => v.id === id)?.name;

  return (
    <div className="flex min-h-dvh flex-col bg-cream font-sans text-stone-800 antialiased lg:h-dvh lg:overflow-hidden">
      <Header tabs={TABS as Tab[]} tab={tab} onTab={(id) => setTab(id as TabId)} user={user} onSignIn={onSignIn} onSignOut={onSignOut} signingIn={signingIn} />
      <main className="mx-auto flex w-full max-w-[1200px] min-h-0 flex-1 flex-col gap-4 px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6 sm:pt-6 sm:pb-6">
        {banner}
        {tab === 'overview' && store.ready && (
          <CalendarSuggestions suggestions={suggested.suggestions} now={now} onAdd={(m) => importEvents([m])} onDismiss={suggested.dismiss} />
        )}
        <div className="min-h-0 flex-1">{content}</div>
      </main>

      {dialog?.kind === 'vehicle' && may.settings && (
        <VehicleDialog
          vehicle={dialog.vehicle}
          onClose={close}
          onSave={(input, defaultSchedule) => {
            const { id, undo } = actions.saveVehicle(dialog.vehicle?.id ?? null, input, { defaultSchedule });
            if (!dialog.vehicle) {
              setCarId(id);
              setTab('cars');
              notify(`Added ${input.name.trim()}`, undo);
            }
          }}
          onDelete={
            dialog.vehicle
              ? () => {
                  const gone = dialog.vehicle!;
                  notify(`Deleted ${gone.name}`, actions.deleteVehicle(gone.id));
                  setCarId(null);
                }
              : undefined
          }
        />
      )}
      {dialog?.kind === 'item' && (
        <ServiceItemDialog
          item={dialog.item}
          unit={unit}
          now={now}
          onClose={close}
          onSave={(input) => {
            const undo = actions.saveServiceItem(dialog.item?.id ?? null, { ...input, vehicleId: dialog.vehicleId });
            notify(dialog.item ? `Saved ${input.name.trim()}` : `Added ${input.name.trim()} to ${vehicleName(dialog.vehicleId) ?? 'the car'}`, undo);
          }}
          onDelete={dialog.item && may.change(dialog.item) ? () => notify(`Removed ${dialog.item!.name}`, actions.deleteServiceItem(dialog.item!.id)) : undefined}
        />
      )}
      {dialog?.kind === 'reading' && (
        <ReadingDialog
          vehicle={data.vehicles.find((v) => v.id === dialog.vehicleId) ?? null}
          latest={carOdometer(dialog.vehicleId, data.readings, data.serviceLog, data.serviceItems).latest}
          unit={unit}
          now={now}
          onClose={close}
          onSave={(input) => notify(`Logged ${input.reading.toLocaleString('en-US')} for ${vehicleName(dialog.vehicleId)}`, actions.logReading({ ...input, vehicleId: dialog.vehicleId }))}
        />
      )}
      {dialog?.kind === 'renewal' && (
        <RenewalDialog
          renewal={dialog.renewal}
          vehicleId={dialog.vehicleId}
          vehicles={data.vehicles}
          now={now}
          onClose={close}
          onSave={(input) => notify(dialog.renewal ? `Saved ${input.name.trim()}` : `Added ${input.name.trim()}`, actions.saveRenewal(dialog.renewal?.id ?? null, input))}
          onDelete={dialog.renewal && may.change(dialog.renewal) ? () => notify(`Deleted ${dialog.renewal!.name}`, actions.deleteRenewal(dialog.renewal!.id)) : undefined}
        />
      )}
      {dialog?.kind === 'visit' && (
        <VisitDialog
          visit={dialog.visit}
          prefill={dialog.prefill}
          data={data}
          unit={unit}
          now={now}
          onClose={close}
          onSave={(input) => {
            const undo = actions.saveVisit(dialog.visit?.id ?? null, input);
            notify(dialog.visit ? `Saved ${input.what.trim()}` : `Logged ${input.what.trim()} on ${formatYmd(input.date, { day: 'numeric', month: 'short' })}`, undo);
          }}
          onDelete={dialog.visit && may.change(dialog.visit) ? () => notify(`Deleted ${dialog.visit!.what}`, actions.deleteVisit(dialog.visit!.id)) : undefined}
        />
      )}
      {dialog?.kind === 'appointment' && (
        <AppointmentDialog
          appointment={dialog.appointment}
          vehicleId={dialog.vehicleId}
          now={now}
          vehicles={data.vehicles}
          shops={data.contacts}
          calendarAvailable={calendar}
          canMarkPrivate={may.seePrivate}
          onClose={close}
          onSave={(input) => {
            const undo = actions.saveAppointment(dialog.appointment?.id ?? null, input);
            if (!dialog.appointment) notify(`Added ${input.title.trim()}`, undo);
          }}
          onDelete={dialog.appointment && may.change(dialog.appointment) ? () => notify(`Deleted ${dialog.appointment!.title}`, actions.deleteAppointment(dialog.appointment!.id)) : undefined}
        />
      )}
      {dialog?.kind === 'contact' && (
        <ContactDialog
          contact={dialog.contact}
          app={APP}
          roles={ROLES}
          title={{ add: 'New shop', edit: 'Edit shop' }}
          namePlaceholder="Example Auto Service"
          auth={auth}
          canMarkPrivate={may.seePrivate}
          onClose={close}
          onSave={(input) => {
            actions.saveContact(dialog.contact?.id ?? null, input);
            if (!dialog.contact) notify(`Added ${input.name}`);
          }}
          onDelete={
            dialog.contact && may.change(dialog.contact)
              ? () => {
                  const gone = dialog.contact!;
                  actions.deleteContact(gone.id);
                  notify(`Deleted ${gone.name}`, () => actions.restoreContact(gone));
                }
              : undefined
          }
        />
      )}
      <Toast toast={toast} onDone={clearToast} />
    </div>
  );
}
