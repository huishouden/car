import { useState } from 'react';
import type { Vehicle } from '../lib/model';
import { LIMITS } from '../lib/model';
import { UNIT_NAMES, formatDistance, parseReading, type DistanceUnit } from '../lib/distance';
import type { OdometerPoint } from '../lib/odometer';
import { formatYmd } from '../lib/format';
import { isYmd, toYmd } from '../lib/time';
import type { ReadingInput } from '../data/types';
import { Dialog, Field, ghostButton, inputClass, primaryButton } from './ui';

export function ReadingDialog({ vehicle, latest, unit, now, onSave, onClose }: {
  vehicle: Vehicle | null;
  latest: OdometerPoint | null;
  unit: DistanceUnit;
  now: number;
  onSave: (input: Omit<ReadingInput, 'vehicleId'>) => void;
  onClose: () => void;
}) {
  const [reading, setReading] = useState('');
  const [date, setDate] = useState(toYmd(now));
  const [note, setNote] = useState('');
  const value = parseReading(reading);
  const valid = value !== null && isYmd(date);
  const lower = value !== null && latest && date >= latest.date && value < latest.reading;

  const save = () => {
    if (!valid || value === null) return;
    onSave({ date, reading: value, note });
    onClose();
  };

  return (
    <Dialog
      title={`Odometer: ${vehicle?.name ?? 'car'}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={ghostButton} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={primaryButton} disabled={!valid} onClick={save}>
            Save reading
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
        <Field label={`Reading in ${UNIT_NAMES[unit].many}`} hint={latest ? `Last: ${formatDistance(latest.reading, unit)} on ${formatYmd(latest.date)}` : undefined}>
          <input className={`${inputClass} text-2xl font-semibold tabular-nums`} inputMode="numeric" value={reading} onChange={(e) => setReading(e.target.value)} placeholder="42,180" autoComplete="off" />
        </Field>
        {lower && (
          <p role="status" className="rounded-xl bg-terracotta-light px-3 py-2 text-base text-terracotta-dark">
            That is lower than the last reading. Save anyway if the last one was wrong.
          </p>
        )}
        <Field label="Date">
          <input className={inputClass} type="date" value={date} max={toYmd(now)} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Note (optional)">
          <input className={inputClass} value={note} maxLength={LIMITS.readingNote} onChange={(e) => setNote(e.target.value)} placeholder="Before the road trip" />
        </Field>
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}
