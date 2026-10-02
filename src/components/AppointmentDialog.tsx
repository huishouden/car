import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { CalendarMatch } from '@huishouden/pwa-kit/calendar';
import type { Contact } from '@huishouden/pwa-kit/contacts';
import type { Appointment, Vehicle } from '../lib/model';
import { LIMITS } from '../lib/model';
import { fromCalendar, guessVehicle } from '../lib/calendarImport';
import { addDays, fromLocalInput, toLocalInput } from '@huishouden/pwa-kit/time';
import type { AppointmentInput } from '../data/types';
import { CalendarFind, LinkedEvent } from '@huishouden/pwa-kit/react/calendar';
import { auth } from '../data/firebase';
import { Dialog, Field, deleteButton, ghostButton, inputClass, primaryButton, selectClass } from '@huishouden/pwa-kit/react/ui';
import { PrivateCheckbox } from '@huishouden/pwa-kit/react/contacts';

export function AppointmentDialog({ appointment, vehicleId: initialVehicle, now, vehicles, shops, calendarAvailable, canMarkPrivate = true, onSave, onDelete, onClose }: {
  appointment: Appointment | null;
  vehicleId?: string;
  now: number;
  vehicles: Vehicle[];
  shops: Contact[];
  calendarAvailable: boolean;
  /** Admins and members may keep an appointment to themselves; helpers and kids save open ones. */
  canMarkPrivate?: boolean;
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
  const [isPrivate, setPrivate] = useState(appointment?.private === true);
  const [event, setEvent] = useState(appointment?.calendarEventId || appointment?.calendarLink ? { id: appointment.calendarEventId, link: appointment.calendarLink } : null);
  const at = fromLocalInput(`${date}T${time}`);
  const valid = title.trim().length > 0 && at !== null;
  // A shop that was deleted (or no longer shown in Car) still appears until another is picked.
  const missingShop = shopId && !shops.some((c) => c.id === shopId);

  const save = () => {
    if (!valid || at === null) return;
    onSave({ title, at, vehicleId: vehicleId || undefined, location, notes, shopId: shopId || undefined, calendarEventId: event?.id, calendarLink: event?.link, private: canMarkPrivate && isPrivate });
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

        <CalendarFind auth={auth} app="Car" query={title} available={calendarAvailable} onPick={pickMatch} />

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
        {event && <LinkedEvent link={event.link} onUnlink={() => setEvent(null)} />}
        {canMarkPrivate && <PrivateCheckbox checked={isPrivate} onChange={setPrivate} />}
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}
