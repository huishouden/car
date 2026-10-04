import { useState } from 'react';
import { CirclePause, Trash2 } from 'lucide-react';
import type { ServiceItem } from '../lib/model';
import { LIMITS } from '../lib/model';
import { formatReading, parseReading, unitWord, type DistanceUnit } from '../lib/distance';
import { serviceSuggestions } from '../lib/schedule';
import { useT } from '../i18n';
import { isYmd, toYmd } from '@huishouden/pwa-kit/time';
import type { ServiceItemInput } from '../data/types';
import { Chip, Dialog, Field, deleteButton, ghostButton, inputClass, primaryButton } from '@huishouden/pwa-kit/react/ui';

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
  const t = useT();
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
  const units = unitWord(unit);

  const save = () => {
    if (!valid) return;
    onSave({ name, everyMonths, everyDistance: everyDistance ?? undefined, lastDate: lastDate || undefined, lastOdometer: odometer ?? undefined, notes });
    onClose();
  };

  return (
    <Dialog
      title={item ? t('row.edit', { name: item.name }) : t('item.new')}
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
              <Trash2 size={18} /> {t('common.remove')}
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
              <CirclePause size={18} /> {t('todo.pause')}
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
        <Field label={t('form.what')}>
          <input className={inputClass} value={name} maxLength={LIMITS.itemName} onChange={(e) => setName(e.target.value)} placeholder={t('item.oil')} autoComplete="off" />
        </Field>
        {!item && (
          <div className="flex flex-wrap gap-2" role="group" aria-label={t('item.suggestions')}>
            {serviceSuggestions().map((s) => (
              <Chip key={s} active={name === s} onClick={() => setName(s)}>
                {s}
              </Chip>
            ))}
          </div>
        )}
        <fieldset>
          <legend className="mb-1.5 block text-sm font-medium text-ink-soft">{t('item.every')}</legend>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex items-center gap-2">
              <input className={inputClass} inputMode="numeric" value={months} onChange={(e) => setMonths(e.target.value.replace(/\D/g, ''))} aria-label={t('item.everyMonths')} aria-invalid={!monthsValid} />
              <span className="text-base text-ink-soft">{t('item.months')}</span>
            </label>
            <label className="flex items-center gap-2">
              <input className={inputClass} inputMode="numeric" value={distance} onChange={(e) => setDistance(e.target.value)} aria-label={t('item.everyDistance', { units })} aria-invalid={!distanceValid} />
              <span className="text-base text-ink-soft">{units}</span>
            </label>
          </div>
          <p className="mt-1 text-sm text-muted">{t('item.everyHint')}</p>
        </fieldset>
        <fieldset>
          <legend className="mb-1.5 block text-sm font-medium text-ink-soft">{t('item.lastDone')}</legend>
          <div className="grid grid-cols-2 gap-3">
            <input className={inputClass} type="date" value={lastDate} max={toYmd(now)} onChange={(e) => setLastDate(e.target.value)} aria-label={t('item.lastDoneOn')} />
            <label className="flex items-center gap-2">
              <input className={inputClass} inputMode="numeric" value={lastOdometer} onChange={(e) => setLastOdometer(e.target.value)} aria-label={t('item.lastDoneAt')} placeholder={t('odometer.title')} aria-invalid={odometer === null} />
              <span className="text-base text-ink-soft">{units}</span>
            </label>
          </div>
          <p className="mt-1 text-sm text-muted">{t('item.lastDoneHint')}</p>
        </fieldset>
        <Field label={t('form.notesOptional')}>
          <textarea className={`${inputClass} min-h-20`} value={notes} maxLength={LIMITS.itemNotes} onChange={(e) => setNotes(e.target.value)} placeholder={t('item.notesPlaceholder')} />
        </Field>
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}
