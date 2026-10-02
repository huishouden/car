import { CalendarPlus, FilePlus, Gauge, Pencil, Plus, Trash2 } from 'lucide-react';
import { UNIT_NAMES, formatDistance, formatReading, type DistanceUnit } from '../lib/distance';
import { formatYmd } from '../lib/format';
import { carOdometer, upcoming } from '../lib/upcoming';
import { daysAgo, daysUntil } from '../lib/time';
import { useClock } from '../clock';
import type { ScreenProps } from '../CarApp';
import { Chip, cardClass, ghostButton, iconButton, overline, primaryButton } from '../components/ui';
import { UpcomingRow } from './rows';

/** One car at a time: its details, odometer, service schedule and renewals. */
export function Cars({ store, unit, open, notify, carId, onCar }: ScreenProps & { carId: string | null; onCar: (id: string) => void }) {
  const { now } = useClock();
  const { data, actions } = store;
  const cars = [...data.vehicles].sort((a, b) => a.createdAt - b.createdAt || a.name.localeCompare(b.name));
  const car = cars.find((v) => v.id === carId) ?? cars[0];

  const header = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Car">
        {cars.map((v) => (
          <Chip key={v.id} active={v.id === car?.id} onClick={() => onCar(v.id)}>
            {v.name}
          </Chip>
        ))}
        <button type="button" className={ghostButton} onClick={() => open({ kind: 'vehicle', vehicle: null })}>
          <Plus size={18} /> Add car
        </button>
      </div>
      <UnitChoice unit={unit} onChange={(u) => actions.setDistanceUnit(u)} />
    </div>
  );

  if (!car)
    return (
      <div className="space-y-6">
        {header}
        <p className={`${cardClass} p-6 text-lg text-stone-600`}>No cars yet. Add one with its nickname, make and model.</p>
      </div>
    );

  const odo = carOdometer(car.id, data.readings, data.serviceLog, data.serviceItems);
  const items = upcoming({ ...data, vehicles: [car], renewals: [] }, unit, now);
  const renewals = upcoming({ ...data, vehicles: [car], serviceItems: [], renewals: data.renewals.filter((r) => r.vehicleId === car.id) }, unit, now);
  const readings = data.readings.filter((r) => r.vehicleId === car.id).sort((a, b) => b.date.localeCompare(a.date) || b.reading - a.reading);
  const monthly = odo.pace ? Math.round((odo.pace * 30.44) / 10) * 10 : null;

  return (
    <div className="flex flex-col gap-6 lg:h-full lg:min-h-0">
      {header}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:min-h-0 lg:flex-1 lg:grid-cols-[340px_minmax(0,1fr)]">
        <div className="flex flex-col gap-6 lg:min-h-0 lg:overflow-y-auto">
          <section className={`${cardClass} px-5 py-4`} aria-label={`${car.name} details`}>
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <h2 className="text-2xl font-semibold text-stone-800">{car.name}</h2>
                {(car.year || car.make || car.model) && <p className="text-lg text-stone-600">{[car.year, car.make, car.model].filter(Boolean).join(' ')}</p>}
              </div>
              <button type="button" className={iconButton} onClick={() => open({ kind: 'vehicle', vehicle: car })} aria-label={`Edit ${car.name}`}>
                <Pencil size={18} />
              </button>
            </div>
            {car.notes && <p className="mt-2 text-base whitespace-pre-line text-stone-600">{car.notes}</p>}
          </section>

          <section className={`${cardClass} px-5 py-4`} aria-label="Odometer">
            <p className={overline}>Odometer</p>
            {odo.latest ? (
              <p className="mt-1 text-stone-800">
                <span className="text-4xl font-semibold tracking-tight tabular-nums">{formatReading(odo.latest.reading)}</span>
                <span className="ml-2 text-lg text-stone-600">{UNIT_NAMES[unit].many}</span>
                <span className="block text-base text-stone-600">Read {daysAgo(-daysUntil(odo.latest.date, now))}</span>
                {monthly && <span className="block text-base text-stone-600">About {formatDistance(monthly, unit)} a month</span>}
              </p>
            ) : (
              <p className="mt-1 text-base text-stone-600">No reading yet. Log one to see what is due by mileage.</p>
            )}
            <button type="button" className={`${primaryButton} mt-3 w-full`} onClick={() => open({ kind: 'reading', vehicleId: car.id })}>
              <Gauge size={20} /> Log odometer
            </button>
            {readings.length > 0 && (
              <ul className="mt-3 border-t border-stone-200" aria-label="Readings">
                {readings.slice(0, 4).map((r) => (
                  <li key={r.id} className="flex items-center gap-3 border-b border-stone-200 py-1 last:border-b-0">
                    <span className="w-28 shrink-0 text-base text-stone-600">{formatYmd(r.date)}</span>
                    <span className="min-w-0 flex-1 text-base text-stone-800 tabular-nums">{formatDistance(r.reading, unit)}</span>
                    <button
                      type="button"
                      className={iconButton}
                      aria-label={`Delete reading ${formatReading(r.reading)} from ${formatYmd(r.date)}`}
                      onClick={() => notify(`Deleted reading ${formatReading(r.reading)}`, actions.deleteReading(r.id))}
                    >
                      <Trash2 size={18} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="flex flex-col gap-6 lg:min-h-0 lg:overflow-y-auto">
          <section className={cardClass} aria-label="Service schedule">
            <div className="flex items-center justify-between gap-3 border-b border-stone-200 px-5 py-3">
              <h3 className="text-xl font-semibold text-stone-800">Service schedule</h3>
              <button type="button" className={ghostButton} onClick={() => open({ kind: 'item', vehicleId: car.id, item: null })}>
                <CalendarPlus size={18} /> Add item
              </button>
            </div>
            {items.length === 0 && <p className="px-5 py-4 text-base text-stone-600">Nothing scheduled. Add an oil change, tire rotation or inspection.</p>}
            <ul>
              {items.map((entry) => (
                <UpcomingRow key={entry.id} entry={entry} store={store} unit={unit} now={now} open={open} notify={notify} showCar={false} />
              ))}
            </ul>
          </section>

          <section className={cardClass} aria-label={`${car.name} renewals`}>
            <div className="flex items-center justify-between gap-3 border-b border-stone-200 px-5 py-3">
              <h3 className="text-xl font-semibold text-stone-800">Renewals</h3>
              <button type="button" className={ghostButton} onClick={() => open({ kind: 'renewal', renewal: null, vehicleId: car.id })}>
                <FilePlus size={18} /> Add renewal
              </button>
            </div>
            {renewals.length === 0 && <p className="px-5 py-4 text-base text-stone-600">No renewals for this car. Registration and the inspection sticker go here.</p>}
            <ul>
              {renewals.map((entry) => (
                <UpcomingRow key={entry.id} entry={entry} store={store} unit={unit} now={now} open={open} notify={notify} showCar={false} />
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}

/** The unit every odometer in the household reads in. */
function UnitChoice({ unit, onChange }: { unit: DistanceUnit; onChange: (u: DistanceUnit) => void }) {
  return (
    <div className="flex items-center gap-2" role="group" aria-label="Distance unit">
      <span className="text-base text-stone-600">Odometers read in</span>
      {(['mi', 'km'] as const).map((u) => (
        <Chip key={u} active={unit === u} onClick={() => onChange(u)}>
          {UNIT_NAMES[u].label}
        </Chip>
      ))}
    </div>
  );
}

