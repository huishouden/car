import { useState } from 'react';
import { CalendarSearch, ExternalLink, MapPin, Trash2, X } from 'lucide-react';
import type { CalendarMatch } from '@huishouden/pwa-kit/calendar';
import type { Contact } from '@huishouden/pwa-kit/contacts';
import type { Appointment, Vehicle } from '../lib/model';
import { LIMITS } from '../lib/model';
import { fromCalendar, guessVehicle } from '../lib/calendarImport';
import { addDays, fromLocalInput, toLocalInput } from '../lib/time';
import { formatDayShort, formatTime } from '../lib/format';
import type { AppointmentInput } from '../data/types';
import { calendarAsked, useCalendarSearch } from '../data/calendar';
import { Dialog, ErrorNotice, Field, deleteButton, ghostButton, iconButton, inputClass, linkClass, primaryButton, selectClass } from './ui';

export function AppointmentDialog({ appointment, vehicleId: initialVehicle, now, vehicles, shops, calendarAvailable, onSave, onDelete, onClose }: {
  appointment: Appointment | null;
  vehicleId?: string;
  now: number;
  vehicles: Vehicle[];
  shops: Contact[];
  calendarAvailable: boolean;
  onSave: (input: AppointmentInput) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const initial = toLocalInput(appointment?.at ?? addDays(now, 1) + 9 * 3_600_000);
  const [title, setTitle] = useState(appointment?.title ?? '');
  const [vehicleId, setVehicleId] = useState(appointment ? (appointment.vehicleId ?? '') : (initialVehicle ?? (vehicles.length === 1 ? vehicles[0].id : '')));
  const [date, setDate] = useState(initial.slice(0, 10));
  const [time, setTime] = useState(initial.slice(11));
  const [location, setLocation] = useState(appointment?.location ?? '');
  const [notes, setNotes] = useState(appointment?.notes ?? '');
  const [shopId, setShopId] = useState(appointment?.shopId ?? '');
  const [event, setEvent] = useState(appointment?.calendarEventId || appointment?.calendarLink ? { id: appointment.calendarEventId, link: appointment.calendarLink } : null);
  const search = useCalendarSearch();
  const at = fromLocalInput(`${date}T${time}`);
  const valid = title.trim().length > 0 && at !== null;
  // A shop that was deleted (or no longer shown in Car) still appears until another is picked.
  const missingShop = shopId && !shops.some((c) => c.id === shopId);

  const save = () => {
    if (!valid || at === null) return;
    onSave({ title, at, vehicleId: vehicleId || undefined, location, notes, shopId: shopId || undefined, calendarEventId: event?.id, calendarLink: event?.link });
    onClose();
  };

  const pickMatch = (m: CalendarMatch) => {
    const filled = fromCalendar(m);
    const local = toLocalInput(filled.at);
    setDate(local.slice(0, 10));
    setTime(local.slice(11));
    if (filled.location) setLocation(filled.location);
    if (filled.notes) setNotes(filled.notes);
    if (!vehicleId) setVehicleId(guessVehicle(m, vehicles) ?? '');
    setEvent({ id: filled.calendarEventId, link: filled.calendarLink });
    search.reset();
  };

  const pickShop = (id: string) => {
    setShopId(id);
    const c = shops.find((x) => x.id === id);
    if (c?.address && !location.trim()) setLocation(c.address.slice(0, LIMITS.location));
  };

  return (
    <Dialog
      title={appointment ? 'Edit appointment' : 'New appointment'}
      onClose={onClose}
      footer={
        <>
          {onDelete && (
            <button
              type="button"
              className={deleteButton}
              onClick={() => {
                onDelete();
                onClose();
              }}
            >
              <Trash2 size={18} /> Delete
            </button>
          )}
          <button type="button" className={ghostButton} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={primaryButton} disabled={!valid} onClick={save}>
            Save
          </button>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <Field label="What">
          <input className={inputClass} value={title} maxLength={LIMITS.title} onChange={(e) => setTitle(e.target.value)} placeholder="Oil change" />
        </Field>

        <div className="space-y-2">
          <button
            type="button"
            className={`${ghostButton} bg-forest-50 text-forest-700 hover:bg-forest-100 disabled:opacity-50`}
            disabled={!calendarAvailable || !title.trim() || search.state.status === 'searching'}
            onClick={() => void search.run(title)}
          >
            <CalendarSearch size={18} /> {search.state.status === 'searching' ? 'Searching your calendars' : 'Find in my calendar'}
          </button>
          <CalendarHint available={calendarAvailable} />
          {search.state.status === 'error' && <ErrorNotice message={search.state.message} onRetry={() => void search.run(title)} />}
          {search.state.status === 'done' && search.state.matches.length === 0 && (
            <p role="status" className="text-base text-stone-600">
              No events matching "{title.trim()}" in your calendars from last week to a year ahead.
            </p>
          )}
          {search.state.status === 'done' && search.state.matches.length > 0 && (
            <ul className="grid gap-1.5" aria-label="Calendar matches">
              {search.state.matches.map((m) => (
                <li key={`${m.id}-${m.start}`}>
                  <button type="button" onClick={() => pickMatch(m)} className="w-full rounded-xl border border-stone-200 px-3 py-2 text-left hover:border-forest-500 hover:bg-forest-50">
                    <span className="block font-medium text-stone-800 [overflow-wrap:anywhere]">{m.title}</span>
                    <span className="block text-sm text-stone-600">
                      {formatDayShort(m.start)}
                      {m.allDay ? ', all day' : `, ${formatTime(m.start)}`} · {m.calendarName}
                    </span>
                    {m.location && (
                      <span className="flex items-start gap-1 text-sm text-stone-600 [overflow-wrap:anywhere]">
                        <MapPin size={14} className="mt-0.5 shrink-0" aria-hidden="true" /> {m.location}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Date">
            <input className={inputClass} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Time">
            <input className={inputClass} type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {vehicles.length > 0 && (
            <Field label="Car">
              <select className={selectClass} value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
                <option value="">Any car</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </Field>
          )}
          {(shops.length > 0 || shopId) && (
            <Field label="Shop (optional)">
              <select className={selectClass} value={shopId} onChange={(e) => pickShop(e.target.value)}>
                <option value="">No shop</option>
                {shops.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
                {missingShop && <option value={shopId}>A removed shop</option>}
              </select>
            </Field>
          )}
        </div>
        <Field label="Where (optional)">
          <input className={inputClass} value={location} maxLength={LIMITS.location} onChange={(e) => setLocation(e.target.value)} />
        </Field>
        <Field label="Notes (optional)">
          <textarea className={`${inputClass} min-h-20`} maxLength={LIMITS.appointmentNotes} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        {event && (
          <div className="flex items-center gap-2 rounded-xl bg-forest-50 py-0.5 pr-1 pl-3 text-base text-stone-700">
            <span className="min-w-0 flex-1">From your calendar.</span>
            {event.link && (
              <a className={linkClass} href={event.link} target="_blank" rel="noopener noreferrer">
                <ExternalLink size={16} aria-hidden="true" /> Open in Calendar
              </a>
            )}
            <button type="button" className={iconButton} aria-label="Unlink from the calendar event" onClick={() => setEvent(null)}>
              <X size={18} />
            </button>
          </div>
        )}
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}

/** One line before Google's first permission window, or why the search is off. */
export function CalendarHint({ available }: { available: boolean }) {
  if (!available) return <p className="text-base text-stone-600">Sign in to search your calendar.</p>;
  if (!calendarAsked()) return <p className="text-base text-stone-600">Google will ask once to let Car read your calendar. Car never changes it.</p>;
  return null;
}
