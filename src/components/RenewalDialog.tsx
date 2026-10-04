import { useState } from 'react';
import { Archive, Trash2 } from 'lucide-react';
import type { Renewal, RenewalKind, Vehicle } from '../lib/model';
import { LIMITS, RENEWAL_KINDS, renewalLabel } from '../lib/model';
import { useT } from '../i18n';
import { describeMonths } from '@huishouden/pwa-kit/schedule';
import { DEFAULT_RENEWAL_MONTHS } from '../lib/renewals';
import { addMonths, isYmd, toYmd } from '@huishouden/pwa-kit/time';
import type { RenewalInput } from '../data/types';
import { Chip, Dialog, Field, deleteButton, ghostButton, inputClass, primaryButton, selectClass } from '@huishouden/pwa-kit/react/ui';

const REPEATS = [0, 1, 3, 6, 12, 24];

export function RenewalDialog({ renewal, vehicleId, vehicles, now, onSave, onDelete, onHandled, onClose }: {
  renewal: Renewal | null;
  /** Prefills the car for a new renewal. */
  vehicleId?: string;
  vehicles: Vehicle[];
  now: number;
  onSave: (input: RenewalInput) => void;
  onDelete?: () => void;
  /** Left out for a new one, and where the person may not change it. */
  onHandled?: () => void;
  onClose: () => void;
}) {
  const t = useT();
  const [kind, setKind] = useState<RenewalKind>(renewal?.kind ?? 'registration');
  const [name, setName] = useState(renewal?.name ?? renewalLabel('registration'));
  const [car, setCar] = useState(renewal ? (renewal.vehicleId ?? '') : (vehicleId ?? vehicles[0]?.id ?? ''));
  const [dueDate, setDueDate] = useState(renewal?.dueDate ?? addMonths(toYmd(now), 1));
  const [every, setEvery] = useState(renewal ? (renewal.everyMonths ?? 0) : (DEFAULT_RENEWAL_MONTHS.registration ?? 0));
  const [notes, setNotes] = useState(renewal?.notes ?? '');
  const valid = name.trim().length > 0 && isYmd(dueDate);

  const pickKind = (k: RenewalKind) => {
    // The name follows the kind until someone types their own.
    if (!name.trim() || name === renewalLabel(kind)) setName(k === 'other' ? '' : renewalLabel(k));
    if (!renewal) setEvery(DEFAULT_RENEWAL_MONTHS[k] ?? 0);
    // Insurance and toll accounts often cover every car.
    if (!renewal && (k === 'insurance' || k === 'toll') && vehicles.length > 1) setCar('');
    setKind(k);
  };

  const save = () => {
    if (!valid) return;
    onSave({ kind, name, vehicleId: car || undefined, dueDate, everyMonths: every || undefined, notes });
    onClose();
  };

  return (
    <Dialog
      title={renewal ? t('row.edit', { name: renewal.name }) : t('renewal.new')}
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
              <Trash2 size={18} /> {t('common.delete')}
            </button>
          )}
          {onHandled && (
            <button
              type="button"
              className={ghostButton}
              onClick={() => {
                onHandled();
                onClose();
              }}
            >
              <Archive size={18} /> {t('todo.markHandled')}
            </button>
          )}
          <button type="button" className={ghostButton} onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="button" className={primaryButton} disabled={!valid} onClick={save}>
            {t('common.save')}
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
        <fieldset>
          <legend className="mb-1.5 block text-sm font-medium text-ink-soft">{t('renewal.kind')}</legend>
          <div className="flex flex-wrap gap-2">
            {RENEWAL_KINDS.map((k) => (
              <Chip key={k} active={kind === k} onClick={() => pickKind(k)}>
                {renewalLabel(k)}
              </Chip>
            ))}
          </div>
        </fieldset>
        <Field label={t('common.name')}>
          <input className={inputClass} value={name} maxLength={LIMITS.renewalName} onChange={(e) => setName(e.target.value)} placeholder={t('renewal.namePlaceholder')} autoComplete="off" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('cars.car')}>
            <select className={selectClass} value={car} onChange={(e) => setCar(e.target.value)}>
              <option value="">{t('cars.all')}</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={kind === 'registration' || kind === 'inspection' ? t('renewal.expiresOn') : t('renewal.dueOn')}>
            <input className={inputClass} type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </Field>
        </div>
        <Field label={t('renewal.repeats')}>
          <select className={selectClass} value={every} onChange={(e) => setEvery(Number(e.target.value))}>
            {[...new Set([...REPEATS, every])].sort((a, b) => a - b).map((m) => (
              <option key={m} value={m}>
                {describeMonths(m || undefined)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('form.notesOptional')}>
          <textarea className={`${inputClass} min-h-20`} value={notes} maxLength={LIMITS.renewalNotes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}
