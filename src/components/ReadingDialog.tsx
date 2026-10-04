import { useState } from 'react';
import type { Vehicle } from '../lib/model';
import { LIMITS } from '../lib/model';
import { formatDistance, formatReading, parseReading, unitWord, type DistanceUnit } from '../lib/distance';
import { useT } from '../i18n';
import type { MeterReading as OdometerPoint } from '@huishouden/pwa-kit/schedule';
import { formatYmd, isYmd, toYmd } from '@huishouden/pwa-kit/time';
import type { ReadingInput } from '../data/types';
import { Dialog, Field, ghostButton, inputClass, primaryButton } from '@huishouden/pwa-kit/react/ui';

export function ReadingDialog({ vehicle, latest, unit, now, onSave, onClose }: {
  vehicle: Vehicle | null;
  latest: OdometerPoint | null;
  unit: DistanceUnit;
  now: number;
  onSave: (input: Omit<ReadingInput, 'vehicleId'>) => void;
  onClose: () => void;
}) {
  const t = useT();
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
      title={t('reading.title', { car: vehicle?.name ?? t('toast.theCar') })}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={ghostButton} onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="button" className={primaryButton} disabled={!valid} onClick={save}>
            {t('reading.save')}
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
        <Field label={t('reading.label', { units: unitWord(unit) })} hint={latest ? t('reading.last', { distance: formatDistance(latest.reading, unit), date: formatYmd(latest.date) }) : undefined}>
          <input className={`${inputClass} text-2xl font-semibold tabular-nums`} inputMode="numeric" value={reading} onChange={(e) => setReading(e.target.value)} placeholder={formatReading(42180)} autoComplete="off" />
        </Field>
        {lower && (
          <p role="status" className="rounded-xl bg-attention-tint px-3 py-2 text-base text-attention">
            {t('reading.lower')}
          </p>
        )}
        <Field label={t('common.date')}>
          <input className={inputClass} type="date" value={date} max={toYmd(now)} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label={t('form.noteOptional')}>
          <input className={inputClass} value={note} maxLength={LIMITS.readingNote} onChange={(e) => setNote(e.target.value)} placeholder={t('reading.notePlaceholder')} />
        </Field>
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}
