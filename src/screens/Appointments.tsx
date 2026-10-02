import { useState } from 'react';
import { CalendarArrowDown, CalendarPlus, CarFront, ChevronDown, ChevronUp, ExternalLink, MapPin, Pencil, Phone, Plus, Store } from 'lucide-react';
import type { CalendarMatch } from '@huishouden/pwa-kit/calendar';
import type { Contact } from '@huishouden/pwa-kit/contacts';
import { telHref } from '@huishouden/pwa-kit/places';
import type { Appointment, Vehicle } from '../lib/model';
import { CAR_CALENDAR_QUERIES, fromCalendar, guessVehicle, notImported } from '../lib/calendarImport';
import { relativeDay } from '../lib/time';
import { formatDayLong, formatDayShort, formatTime, monthShort } from '../lib/format';
import { useClock } from '../clock';
import { useCalendarSearch } from '../data/calendar';
import { CalendarHint } from '../components/AppointmentDialog';
import { Dialog, ErrorNotice, cardClass, ghostButton, iconButton, linkClass, primaryButton, secondaryButton } from '../components/ui';

import type { ScreenProps } from '../CarApp';

/** Service appointments: coming up first, the past folded away; Import from calendar finds them. */
export function Appointments({ store, open, notify, calendarAvailable }: ScreenProps & { calendarAvailable: boolean }) {
  const onAdd = () => open({ kind: 'appointment', appointment: null });
  const onEdit = (a: Appointment) => open({ kind: 'appointment', appointment: a });
  const vehicles = store.data.vehicles;
  const { now } = useClock();
  const [showPast, setShowPast] = useState(false);
  const [importing, setImporting] = useState(false);
  const scan = useCalendarSearch();
  const all = store.data.appointments;
  const contacts = store.data.contacts;
  const upcoming = all.filter((a) => a.at >= now - 3_600_000).sort((a, b) => a.at - b.at);
  const past = all.filter((a) => a.at < now - 3_600_000).sort((a, b) => b.at - a.at);
  const runScan = () => void scan.run(CAR_CALENDAR_QUERIES, { limit: 25 });

  return (
    <div className="mx-auto max-w-3xl space-y-6 lg:h-full lg:overflow-y-auto">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
          <h2 className="text-2xl font-semibold text-stone-800">Appointments</h2>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={secondaryButton}
              disabled={!calendarAvailable}
              onClick={() => {
                setImporting(true);
                // Straight from the tap: the first search opens Google's permission window.
                runScan();
              }}
            >
              <CalendarArrowDown size={20} /> Import from calendar
            </button>
            <button type="button" className={primaryButton} onClick={onAdd}>
              <CalendarPlus size={20} /> Add appointment
            </button>
          </div>
        </div>
        <div className="mt-1 flex justify-end text-right">
          <CalendarHint available={calendarAvailable} />
        </div>
      </div>

      <section className={cardClass} aria-label="Upcoming appointments">
        {upcoming.length === 0 && <p className="p-6 text-lg text-stone-600">No appointments coming up.</p>}
        <ul>
          {upcoming.map((a, i) => (
            <Row key={a.id} a={a} now={now} contacts={contacts} vehicles={vehicles} first={i === 0} onEdit={() => onEdit(a)} />
          ))}
        </ul>
      </section>

      {past.length > 0 && (
        <section aria-label="Past appointments">
          <button type="button" className={ghostButton} onClick={() => setShowPast((s) => !s)} aria-expanded={showPast}>
            {showPast ? <ChevronUp size={18} /> : <ChevronDown size={18} />} Past ({past.length})
          </button>
          {showPast && (
            <ul className={`${cardClass} mt-2`}>
              {past.map((a) => (
                <Row key={a.id} a={a} now={now} contacts={contacts} vehicles={vehicles} onEdit={() => onEdit(a)} />
              ))}
            </ul>
          )}
        </section>
      )}

      {importing && (
        <ImportDialog
          state={scan.state}
          appointments={all}
          onRetry={runScan}
          onAdd={(list) => {
            const undos = list.map((m) => store.actions.saveAppointment(null, { ...fromCalendar(m), vehicleId: guessVehicle(m, vehicles) }));
            notify(list.length === 1 ? `Added ${list[0].title}` : `Added ${list.length} appointments`, () => undos.forEach((u) => u()));
          }}
          onClose={() => {
            setImporting(false);
            scan.reset();
          }}
        />
      )}
    </div>
  );
}

function Row({ a, now, contacts, vehicles, first, onEdit }: { a: Appointment; now: number; contacts: Contact[]; vehicles: Vehicle[]; first?: boolean; onEdit: () => void }) {
  const d = new Date(a.at);
  const who = a.shopId ? contacts.find((c) => c.id === a.shopId) : undefined;
  const car = a.vehicleId ? vehicles.find((v) => v.id === a.vehicleId) : undefined;
  return (
    <li className="flex items-start gap-5 border-b border-stone-200 p-5 last:border-b-0">
      <div className={`flex w-16 shrink-0 flex-col items-center rounded-xl py-2 ${first ? 'bg-forest-700 text-white' : 'bg-forest-50 text-forest-700'}`}>
        <span className="text-sm font-medium">{monthShort(a.at)}</span>
        <span className="text-2xl font-semibold tabular-nums">{d.getDate()}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className={`${first ? 'text-2xl' : 'text-xl'} font-semibold text-stone-800`}>{a.title}</p>
        <p className="mt-0.5 text-base text-stone-700">
          <span className="font-medium text-forest-700">{relativeDay(a.at, now)}</span> · {formatDayLong(a.at)}, {formatTime(a.at)}
        </p>
        {car && (
          <p className="mt-0.5 flex items-center gap-1.5 text-base text-stone-600">
            <CarFront size={16} aria-hidden="true" /> {car.name}
          </p>
        )}
        {who && (
          <div className="flex flex-wrap items-center gap-x-4 text-base text-stone-600">
            <span className="flex items-center gap-1.5">
              <Store size={16} aria-hidden="true" /> {who.name}
            </span>
            {who.phone && (
              <a className={`${linkClass} tabular-nums`} href={telHref(who.phone)} aria-label={`Call ${who.name}, ${who.phone}`}>
                <Phone size={16} aria-hidden="true" /> {who.phone}
              </a>
            )}
          </div>
        )}
        {a.location && (
          <p className="mt-0.5 flex items-center gap-1.5 text-base text-stone-600">
            <MapPin size={16} aria-hidden="true" /> {a.location}
          </p>
        )}
        {a.notes && <p className="mt-1 text-base whitespace-pre-line text-stone-600">{a.notes}</p>}
        {a.calendarLink && (
          <a className={linkClass} href={a.calendarLink} target="_blank" rel="noopener noreferrer">
            <ExternalLink size={16} aria-hidden="true" /> Open in Calendar
          </a>
        )}
      </div>
      <button type="button" className={iconButton} onClick={onEdit} aria-label={`Edit ${a.title}`}>
        <Pencil size={18} />
      </button>
    </li>
  );
}

function ImportDialog({ state, appointments, onRetry, onAdd, onClose }: {
  state: ReturnType<typeof useCalendarSearch>['state'];
  appointments: Appointment[];
  onRetry: () => void;
  onAdd: (matches: CalendarMatch[]) => void;
  onClose: () => void;
}) {
  // Recomputed as appointments arrive, so an added event leaves the list.
  const fresh = state.status === 'done' ? notImported(state.matches, appointments) : [];
  return (
    <Dialog
      title="Import from calendar"
      onClose={onClose}
      footer={
        <>
          <button type="button" className={ghostButton} onClick={onClose}>
            Done
          </button>
          {fresh.length > 1 && (
            <button
              type="button"
              className={primaryButton}
              onClick={() => {
                onAdd(fresh);
                onClose();
              }}
            >
              Add all {fresh.length}
            </button>
          )}
        </>
      }
    >
      <p className="text-base text-stone-600">Oil changes, service, tires, inspection, registration and other car events from last week to a year ahead.</p>
      <div className="mt-4">
        {(state.status === 'searching' || state.status === 'idle') && (
          <p role="status" className="text-base text-stone-600">
            Searching your calendars
          </p>
        )}
        {state.status === 'error' && <ErrorNotice message={state.message} onRetry={onRetry} />}
        {state.status === 'done' && fresh.length === 0 && (
          <p role="status" className="text-base text-stone-600">
            {state.matches.length ? 'Every car event in your calendar is already in Car.' : 'No car events found in your calendars.'}
          </p>
        )}
        {fresh.length > 0 && (
          <ul className="divide-y divide-stone-200 rounded-2xl border border-stone-200" aria-label="Calendar events">
            {fresh.map((m) => (
              <li key={`${m.id}-${m.start}`} className="flex items-center gap-3 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-stone-800 [overflow-wrap:anywhere]">{m.title}</p>
                  <p className="text-sm text-stone-600">
                    {formatDayShort(m.start)}
                    {m.allDay ? ', all day' : `, ${formatTime(m.start)}`} · {m.calendarName}
                  </p>
                  {m.location && <p className="text-sm text-stone-600 [overflow-wrap:anywhere]">{m.location}</p>}
                </div>
                <button type="button" className={secondaryButton} onClick={() => onAdd([m])} aria-label={`Add ${m.title}`}>
                  <Plus size={18} /> Add
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Dialog>
  );
}
