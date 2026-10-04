import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { Vehicle } from '../lib/model';
import { LIMITS } from '../lib/model';
import type { VehicleInput } from '../data/types';
import { Checkbox, Dialog, Field, deleteButton, ghostButton, inputClass, primaryButton } from '@huishouden/pwa-kit/react/ui';
import { useT } from '../i18n';

export function VehicleDialog({ vehicle, onSave, onDelete, onClose }: {
  vehicle: Vehicle | null;
  onSave: (input: VehicleInput, defaultSchedule: boolean) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const t = useT();
  const [name, setName] = useState(vehicle?.name ?? '');
  const [make, setMake] = useState(vehicle?.make ?? '');
  const [model, setModel] = useState(vehicle?.model ?? '');
  const [year, setYear] = useState(vehicle?.year ? String(vehicle.year) : '');
  const [notes, setNotes] = useState(vehicle?.notes ?? '');
  const [schedule, setSchedule] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const yearNumber = year.trim() ? Number(year) : undefined;
  const yearValid = yearNumber === undefined || (Number.isInteger(yearNumber) && yearNumber >= LIMITS.minYear && yearNumber <= LIMITS.maxYear);
  const valid = name.trim().length > 0 && yearValid;

  const save = () => {
    if (!valid) return;
    onSave({ name, make, model, year: yearNumber, notes }, !vehicle && schedule);
    onClose();
  };

  return (
    <Dialog
      title={vehicle ? t('row.edit', { name: vehicle.name }) : t('vehicle.new')}
      onClose={onClose}
      footer={
        confirming ? (
          <>
            <p className="mr-auto text-base text-ink-soft">{t('vehicle.confirmDelete', { name: vehicle?.name ?? '' })}</p>
            <button type="button" className={ghostButton} onClick={() => setConfirming(false)}>
              {t('vehicle.keep')}
            </button>
            <button
              type="button"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-red-700 px-4 font-medium text-white"
              onClick={() => {
                onDelete?.();
                onClose();
              }}
            >
              {t('vehicle.delete')}
            </button>
          </>
        ) : (
          <>
            {onDelete && (
              <button type="button" className={deleteButton} onClick={() => setConfirming(true)}>
                <Trash2 size={18} /> {t('common.delete')}
              </button>
            )}
            <button type="button" className={ghostButton} onClick={onClose}>
              {t('common.cancel')}
            </button>
            <button type="button" className={primaryButton} disabled={!valid} onClick={save}>
              {t('common.save')}
            </button>
          </>
        )
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <Field label={t('vehicle.nickname')} hint={t('vehicle.nicknameHint')}>
          <input className={inputClass} value={name} maxLength={LIMITS.vehicleName} onChange={(e) => setName(e.target.value)} placeholder={t('vehicle.nicknamePlaceholder')} autoComplete="off" />
        </Field>
        <div className="grid grid-cols-[1fr_1fr_6.5rem] gap-3">
          <Field label={t('vehicle.make')}>
            <input className={inputClass} value={make} maxLength={LIMITS.make} onChange={(e) => setMake(e.target.value)} autoComplete="off" />
          </Field>
          <Field label={t('vehicle.model')}>
            <input className={inputClass} value={model} maxLength={LIMITS.model} onChange={(e) => setModel(e.target.value)} autoComplete="off" />
          </Field>
          <Field label={t('vehicle.year')}>
            <input className={inputClass} inputMode="numeric" value={year} maxLength={4} onChange={(e) => setYear(e.target.value.replace(/\D/g, ''))} aria-invalid={!yearValid} />
          </Field>
        </div>
        <Field label={t('form.notesOptional')}>
          <textarea className={`${inputClass} min-h-20`} value={notes} maxLength={LIMITS.vehicleNotes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        {!vehicle && (
          <div>
            <Checkbox checked={schedule} onChange={setSchedule}>
              {t('vehicle.usualSchedule')}
            </Checkbox>
            <p className="ml-9 text-sm text-muted">{t('vehicle.usualScheduleHint')}</p>
          </div>
        )}
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}
