import { useState } from 'react';
import { CalendarArrowDown, CalendarPlus, CarFront, ChevronDown, ChevronUp, ExternalLink, MapPin, Pencil, Phone, Store } from 'lucide-react';
import type { Contact } from '@huishouden/pwa-kit/contacts';
import { telHref } from '@huishouden/pwa-kit/places';
import type { Appointment, Vehicle } from '../lib/model';
import { CAR_CALENDAR_QUERIES } from '../lib/calendarImport';
import type { CalendarMatch } from '@huishouden/pwa-kit/calendar';
import { formatDayLong, formatTime, monthShort, relativeDay } from '@huishouden/pwa-kit/time';
import { useClock } from '@huishouden/pwa-kit/react/clock';
import { CalendarHint, CalendarImportDialog, useCalendarSearch } from '@huishouden/pwa-kit/react/calendar';
import { auth } from '../data/firebase';
import { cardClass, ghostButton, iconButton, linkClass, primaryButton, secondaryButton } from '@huishouden/pwa-kit/react/ui';

import type { ScreenProps } from '../CarApp';
import { PrivateMark } from '@huishouden/pwa-kit/react/contacts';

/** Service appointments: coming up first, the past folded away; Import from calendar finds them. */
export function Appointments({ store, may, open, calendarAvailable, onImport }: ScreenProps & {
  calendarAvailable: boolean;
  /** Adds calendar events as appointments, with a toast. */
  onImport: (list: CalendarMatch[]) => void;
}) {
  const onAdd = () => open({ kind: 'appointment', appointment: null });
  const onEdit = (a: Appointment) => (may.change(a) ? () => open({ kind: 'appointment', appointment: a }) : undefined);
  const vehicles = store.data.vehicles;
  const { now } = useClock();
  const [showPast, setShowPast] = useState(false);
  const [importing, setImporting] = useState(false);
  const scan = useCalendarSearch(auth, 'Car');
  const all = store.data.appointments;
  const contacts = store.data.contacts;
  const upcoming = all.filter((a) => a.at >= now - 3_600_000).sort((a, b) => a.at - b.at);
  const past = all.filter((a) => a.at < now - 3_600_000).sort((a, b) => b.at - a.at);
  const runScan = () => void scan.run(CAR_CALENDAR_QUERIES, { limit: 25 });

  return (
    <div className="mx-auto max-w-3xl space-y-6 lg:h-full lg:overflow-y-auto">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
          <h2 className="text-2xl font-semibold text-ink">Appointments</h2>
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
          <CalendarHint app="Car" available={calendarAvailable} />
        </div>
      </div>

      <section className={cardClass} aria-label="Upcoming appointments">
        {upcoming.length === 0 && <p className="p-6 text-lg text-muted">No appointments coming up.</p>}
        <ul>
          {upcoming.map((a, i) => (
            <Row key={a.id} a={a} now={now} contacts={contacts} vehicles={vehicles} first={i === 0} onEdit={onEdit(a)} />
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
                <Row key={a.id} a={a} now={now} contacts={contacts} vehicles={vehicles} onEdit={onEdit(a)} />
              ))}
            </ul>
          )}
        </section>
      )}

      {importing && (
        <CalendarImportDialog
          state={scan.state}
          intro="Oil changes, service, tires, inspection, registration and other car events from last week to a year ahead."
          noneFound="No car events found in your calendars."
          allImported="Every car event in your calendar is already in Car."
          records={all}
          onRetry={runScan}
          onAdd={onImport}
          onClose={() => {
            setImporting(false);
            scan.reset();
          }}
        />
      )}
    </div>
  );
}

function Row({ a, now, contacts, vehicles, first, onEdit }: { a: Appointment; now: number; contacts: Contact[]; vehicles: Vehicle[]; first?: boolean; onEdit?: () => void }) {
  const d = new Date(a.at);
  const who = a.shopId ? contacts.find((c) => c.id === a.shopId) : undefined;
  const car = a.vehicleId ? vehicles.find((v) => v.id === a.vehicleId) : undefined;
  return (
    <li className="flex items-start gap-5 border-b border-line p-5 last:border-b-0">
      <div className={`flex w-16 shrink-0 flex-col items-center rounded-xl py-2 ${first ? 'bg-primary text-on-primary' : 'bg-tint text-link'}`}>
        <span className="text-sm font-medium">{monthShort(a.at)}</span>
        <span className="text-2xl font-semibold tabular-nums">{d.getDate()}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className={`${first ? 'text-2xl' : 'text-xl'} font-semibold text-ink`}>{a.title}</p>
        {a.private && <PrivateMark />}
        <p className="mt-0.5 text-base text-ink-soft">
          <span className="font-medium text-link">{relativeDay(a.at, now)}</span> · {formatDayLong(a.at)}, {formatTime(a.at)}
        </p>
        {car && (
          <p className="mt-0.5 flex items-center gap-1.5 text-base text-muted">
            <CarFront size={16} aria-hidden="true" /> {car.name}
          </p>
        )}
        {who && (
          <div className="flex flex-wrap items-center gap-x-4 text-base text-muted">
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
          <p className="mt-0.5 flex items-center gap-1.5 text-base text-muted">
            <MapPin size={16} aria-hidden="true" /> {a.location}
          </p>
        )}
        {a.notes && <p className="mt-1 text-base whitespace-pre-line text-muted">{a.notes}</p>}
        {a.calendarLink && (
          <a className={linkClass} href={a.calendarLink} target="_blank" rel="noopener noreferrer">
            <ExternalLink size={16} aria-hidden="true" /> Open in Calendar
          </a>
        )}
      </div>
      {onEdit && (
        <button type="button" className={iconButton} onClick={onEdit} aria-label={`Edit ${a.title}`}>
          <Pencil size={18} />
        </button>
      )}
    </li>
  );
}
