import { useState } from 'react';
import { CirclePause, Trash2 } from 'lucide-react';
import type { ServiceItem } from '../lib/model';
import { LIMITS } from '../lib/model';
import { UNIT_NAMES, formatReading, parseReading, type DistanceUnit } from '../lib/distance';
import { isYmd, toYmd } from '@huishouden/pwa-kit/time';
import type { ServiceItemInput } from '../data/types';
import { Chip, Dialog, Field, deleteButton, ghostButton, inputClass, primaryButton } from '@huishouden/pwa-kit/react/ui';

const SUGGESTIONS = ['Oil change', 'Tire rotation', 'Inspection', 'Wiper blades', 'Brake check', 'Engine air filter', 'Cabin air filter', 'Battery check'];

export function ServiceItemDialog({ item, unit, now, onSave, onDelete, onPause, onClose }: {
  item: ServiceItem | null;
  unit: DistanceUnit;
  now: number;
  onSave: (input: Omit<ServiceItemInput, 'vehicleId'>) => void;
  onDelete?: () => void;
  /** Left out for a new one, and where the person may not change it. */
  onPause?: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(item?.name ?? '');
  const [months, setMonths] = useState(item?.everyMonths ? String(item.everyMonths) : '');
  const [distance, setDistance] = useState(item?.everyDistance ? formatReading(item.everyDistance) : '');
  const [lastDate, setLastDate] = useState(item?.lastDate ?? '');
  const [lastOdometer, setLastOdometer] = useState(item?.lastOdometer !== undefined ? formatReading(item.lastOdometer) : '');
  const [notes, setNotes] = useState(item?.notes ?? '');

  const everyMonths = months.trim() ? Number(months) : undefined;
  const everyDistance = distance.trim() ? parseReading(distance) : undefined;
  const odometer = lastOdometer.trim() ? parseReading(lastOdometer) : undefined;
  const monthsValid = everyMonths === undefined || (Number.isInteger(everyMonths) && everyMonths >= 1 && everyMonths <= LIMITS.maxEveryMonths);
  const distanceValid = everyDistance === undefined || (everyDistance !== null && everyDistance >= 1 && everyDistance <= LIMITS.maxEveryDistance);
  const valid =
    name.trim().length > 0 && monthsValid && distanceValid && (everyMonths !== undefined || everyDistance !== undefined) && odometer !== null && (!lastDate || isYmd(lastDate));
  const units = UNIT_NAMES[unit].many;

  const save = () => {
    if (!valid) return;
    onSave({ name, everyMonths, everyDistance: everyDistance ?? undefined, lastDate: lastDate || undefined, lastOdometer: odometer ?? undefined, notes });
    onClose();
  };

  return (
    <Dialog
      title={item ? `Edit ${item.name}` : 'New service item'}
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
              <Trash2 size={18} /> Remove
            </button>
          )}
          {onPause && (
            <button
              type="button"
              className={ghostButton}
              onClick={() => {
                onPause();
                onClose();
              }}
            >
              <CirclePause size={18} /> Pause
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
          <input className={inputClass} value={name} maxLength={LIMITS.itemName} onChange={(e) => setName(e.target.value)} placeholder="Oil change" autoComplete="off" />
        </Field>
        {!item && (
          <div className="flex flex-wrap gap-2" role="group" aria-label="Suggestions">
            {SUGGESTIONS.map((s) => (
              <Chip key={s} active={name === s} onClick={() => setName(s)}>
                {s}
              </Chip>
            ))}
          </div>
        )}
        <fieldset>
          <legend className="mb-1.5 block text-sm font-medium text-ink-soft">Every</legend>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex items-center gap-2">
              <input className={inputClass} inputMode="numeric" value={months} onChange={(e) => setMonths(e.target.value.replace(/\D/g, ''))} aria-label="Every how many months" aria-invalid={!monthsValid} />
              <span className="text-base text-ink-soft">months</span>
            </label>
            <label className="flex items-center gap-2">
              <input className={inputClass} inputMode="numeric" value={distance} onChange={(e) => setDistance(e.target.value)} aria-label={`Every how many ${units}`} aria-invalid={!distanceValid} />
              <span className="text-base text-ink-soft">{units}</span>
            </label>
          </div>
          <p className="mt-1 text-sm text-muted">Fill in one or both. It is due at whichever comes first.</p>
        </fieldset>
        <fieldset>
          <legend className="mb-1.5 block text-sm font-medium text-ink-soft">Last done (optional)</legend>
          <div className="grid grid-cols-2 gap-3">
            <input className={inputClass} type="date" value={lastDate} max={toYmd(now)} onChange={(e) => setLastDate(e.target.value)} aria-label="Last done on" />
            <label className="flex items-center gap-2">
              <input className={inputClass} inputMode="numeric" value={lastOdometer} onChange={(e) => setLastOdometer(e.target.value)} aria-label="Last done at" placeholder="Odometer" aria-invalid={odometer === null} />
              <span className="text-base text-ink-soft">{units}</span>
            </label>
          </div>
          <p className="mt-1 text-sm text-muted">Logging a service in History fills these in.</p>
        </fieldset>
        <Field label="Notes (optional)">
          <textarea className={`${inputClass} min-h-20`} value={notes} maxLength={LIMITS.itemNotes} onChange={(e) => setNotes(e.target.value)} placeholder="Synthetic 0W-20" />
        </Field>
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}
