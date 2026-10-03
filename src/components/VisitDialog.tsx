import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { ServiceLogEntry } from '../lib/model';
import { LIMITS } from '../lib/model';
import type { CarData } from '../lib/demo';
import { UNIT_NAMES, formatDistance, formatReading, parseReading, type DistanceUnit } from '../lib/distance';
import { centsToInput, parseCents } from '@huishouden/pwa-kit/money';
import { formatYmd, isYmd, toYmd } from '@huishouden/pwa-kit/time';
import { carOdometer } from '../lib/upcoming';
import { joinNames } from '../lib/words';
import type { VisitInput } from '../data/types';
import { Checkbox, Dialog, Field, deleteButton, ghostButton, inputClass, primaryButton, selectClass } from '@huishouden/pwa-kit/react/ui';

export function VisitDialog({ visit, prefill, data, unit, now, onSave, onDelete, onClose }: {
  visit: ServiceLogEntry | null;
  prefill?: Partial<VisitInput>;
  data: CarData;
  unit: DistanceUnit;
  now: number;
  onSave: (input: VisitInput) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const start = { ...prefill, ...visit };
  const [vehicleId, setVehicleId] = useState(start.vehicleId ?? data.vehicles[0]?.id ?? '');
  const [itemIds, setItemIds] = useState<string[]>(start.serviceItemIds ?? []);
  const items = data.serviceItems.filter((i) => i.vehicleId === vehicleId).sort((a, b) => a.name.localeCompare(b.name));
  const autoWhat = (ids: string[]) => joinNames(items.filter((i) => ids.includes(i.id)).map((i) => i.name));
  const [what, setWhat] = useState(start.what ?? autoWhat(itemIds));
  const [date, setDate] = useState(start.date ?? toYmd(now));
  const latest = carOdometer(vehicleId, data.readings, data.serviceLog, data.serviceItems).latest;
  const [odometer, setOdometer] = useState(start.odometer !== undefined ? formatReading(start.odometer) : '');
  const [shopId, setShopId] = useState(start.shopId ?? '');
  const [cost, setCost] = useState(centsToInput(start.costCents));
  const [notes, setNotes] = useState(start.notes ?? '');

  const reading = odometer.trim() ? parseReading(odometer) : undefined;
  const cents = parseCents(cost, { max: LIMITS.maxCostCents });
  const valid = !!vehicleId && what.trim().length > 0 && isYmd(date) && reading !== null && cents !== null && (cents === undefined || cents <= LIMITS.maxCostCents);
  const missingShop = shopId && !data.contacts.some((c) => c.id === shopId);

  const toggle = (id: string, on: boolean) => {
    const next = on ? [...itemIds, id] : itemIds.filter((x) => x !== id);
    // The description follows the ticked items until someone types their own.
    if (!what.trim() || what === autoWhat(itemIds)) setWhat(autoWhat(next));
    setItemIds(next);
  };

  const save = () => {
    if (!valid) return;
    onSave({
      vehicleId,
      date,
      what,
      odometer: reading ?? undefined,
      serviceItemIds: itemIds.filter((id) => items.some((i) => i.id === id)),
      shopId: shopId || undefined,
      costCents: cents ?? undefined,
      notes,
    });
    onClose();
  };

  return (
    <Dialog
      title={visit ? 'Edit service' : 'Log a service'}
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
        {data.vehicles.length > 1 && (
          <Field label="Car">
            <select
              className={selectClass}
              value={vehicleId}
              onChange={(e) => {
                setVehicleId(e.target.value);
                setItemIds([]);
              }}
            >
              {data.vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        {items.length > 0 && (
          <fieldset>
            <legend className="mb-1 block text-sm font-medium text-ink-soft">Covers</legend>
            <div className="grid sm:grid-cols-2">
              {items.map((i) => (
                <Checkbox key={i.id} checked={itemIds.includes(i.id)} onChange={(on) => toggle(i.id, on)}>
                  {i.name}
                </Checkbox>
              ))}
            </div>
          </fieldset>
        )}
        <Field label="What was done">
          <input className={inputClass} value={what} maxLength={LIMITS.what} onChange={(e) => setWhat(e.target.value)} placeholder="Oil change" autoComplete="off" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date">
            <input className={inputClass} type="date" value={date} max={toYmd(now)} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label={`Odometer (${UNIT_NAMES[unit].many})`} hint={latest ? `Last: ${formatDistance(latest.reading, unit)}, ${formatYmd(latest.date, { day: 'numeric', month: 'short' })}` : undefined}>
            <input className={inputClass} inputMode="numeric" value={odometer} onChange={(e) => setOdometer(e.target.value)} aria-invalid={reading === null} />
          </Field>
        </div>
        <div className="grid grid-cols-[1fr_9rem] gap-3">
          <Field label="Shop (optional)">
            <select className={selectClass} value={shopId} onChange={(e) => setShopId(e.target.value)}>
              <option value="">No shop</option>
              {data.contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
              {missingShop && <option value={shopId}>A removed shop</option>}
            </select>
          </Field>
          <Field label="Cost (optional)">
            <input className={`${inputClass} tabular-nums`} inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="$0.00" aria-invalid={cents === null} />
          </Field>
        </div>
        <Field label="Notes (optional)">
          <textarea className={`${inputClass} min-h-20`} value={notes} maxLength={LIMITS.logNotes} onChange={(e) => setNotes(e.target.value)} placeholder="Front brakes have about a year left." />
        </Field>
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}
