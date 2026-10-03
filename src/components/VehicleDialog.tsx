import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { Vehicle } from '../lib/model';
import { LIMITS } from '../lib/model';
import type { VehicleInput } from '../data/types';
import { Checkbox, Dialog, Field, deleteButton, ghostButton, inputClass, primaryButton } from '@huishouden/pwa-kit/react/ui';

export function VehicleDialog({ vehicle, onSave, onDelete, onClose }: {
  vehicle: Vehicle | null;
  onSave: (input: VehicleInput, defaultSchedule: boolean) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
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
      title={vehicle ? `Edit ${vehicle.name}` : 'New car'}
      onClose={onClose}
      footer={
        confirming ? (
          <>
            <p className="mr-auto text-base text-ink-soft">Delete {vehicle?.name} with its schedule, readings, renewals and history?</p>
            <button type="button" className={ghostButton} onClick={() => setConfirming(false)}>
              Keep it
            </button>
            <button
              type="button"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-red-700 px-4 font-medium text-white"
              onClick={() => {
                onDelete?.();
                onClose();
              }}
            >
              Delete car
            </button>
          </>
        ) : (
          <>
            {onDelete && (
              <button type="button" className={deleteButton} onClick={() => setConfirming(true)}>
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
        <Field label="Nickname" hint="What the household calls it. No plate or VIN needed.">
          <input className={inputClass} value={name} maxLength={LIMITS.vehicleName} onChange={(e) => setName(e.target.value)} placeholder="Family van" autoComplete="off" />
        </Field>
        <div className="grid grid-cols-[1fr_1fr_6.5rem] gap-3">
          <Field label="Make">
            <input className={inputClass} value={make} maxLength={LIMITS.make} onChange={(e) => setMake(e.target.value)} autoComplete="off" />
          </Field>
          <Field label="Model">
            <input className={inputClass} value={model} maxLength={LIMITS.model} onChange={(e) => setModel(e.target.value)} autoComplete="off" />
          </Field>
          <Field label="Year">
            <input className={inputClass} inputMode="numeric" value={year} maxLength={4} onChange={(e) => setYear(e.target.value.replace(/\D/g, ''))} aria-invalid={!yearValid} />
          </Field>
        </div>
        <Field label="Notes (optional)">
          <textarea className={`${inputClass} min-h-20`} value={notes} maxLength={LIMITS.vehicleNotes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        {!vehicle && (
          <div>
            <Checkbox checked={schedule} onChange={setSchedule}>
              Start with the usual schedule
            </Checkbox>
            <p className="ml-9 text-sm text-muted">Oil change, tire rotation, inspection and wiper blades. Change or remove any of them later.</p>
          </div>
        )}
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}
