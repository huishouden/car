import { CalendarPlus, FilePlus, Gauge, Pencil, Plus, Trash2 } from 'lucide-react';
import { formatDistance, formatReading, unitWord, type DistanceUnit } from '../lib/distance';
import { capitalize } from '@huishouden/pwa-kit/i18n';
import { useT } from '../i18n';
import { daysAgo, daysUntil, formatYmd } from '@huishouden/pwa-kit/time';
import { carOdometer, setAside, upcoming } from '../lib/upcoming';
import { useClock } from '@huishouden/pwa-kit/react/clock';
import type { ScreenProps } from '../CarApp';
import { Chip, cardClass, ghostButton, iconButton, overline, primaryButton } from '@huishouden/pwa-kit/react/ui';
import { SetAsideRow, UpcomingRow } from './rows';
import { RoleNote } from '@huishouden/pwa-kit/react/roles';

/** One car at a time: its details, odometer, service schedule and renewals. */
export function Cars({ store, unit, may, open, notify, carId, onCar }: ScreenProps & { carId: string | null; onCar: (id: string) => void }) {
  const t = useT();
  const { now } = useClock();
  const { data, actions } = store;
  const cars = [...data.vehicles].sort((a, b) => a.createdAt - b.createdAt || a.name.localeCompare(b.name));
  const car = cars.find((v) => v.id === carId) ?? cars[0];

  const header = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t('cars.car')}>
        {cars.map((v) => (
          <Chip key={v.id} active={v.id === car?.id} onClick={() => onCar(v.id)}>
            {v.name}
          </Chip>
        ))}
        {may.settings && (
          <button type="button" className={ghostButton} onClick={() => open({ kind: 'vehicle', vehicle: null })}>
            <Plus size={18} /> {t('cars.add')}
          </button>
        )}
      </div>
      {may.settings ? <UnitChoice unit={unit} onChange={(u) => actions.setDistanceUnit(u)} /> : <RoleNote action="change-settings" />}
    </div>
  );

  if (!car)
    return (
      <div className="space-y-6">
        {header}
        <p className={`${cardClass} p-6 text-lg text-muted`}>{t('cars.empty')}</p>
      </div>
    );

  const odo = carOdometer(car.id, data.readings, data.serviceLog, data.serviceItems);
  const items = upcoming({ ...data, vehicles: [car], renewals: [] }, unit, now);
  const renewals = upcoming({ ...data, vehicles: [car], serviceItems: [], renewals: data.renewals.filter((r) => r.vehicleId === car.id) }, unit, now);
  const asideItems = setAside({ vehicles: [car], serviceItems: data.serviceItems, renewals: [] });
  const asideRenewals = setAside({ vehicles: [car], serviceItems: [], renewals: data.renewals.filter((r) => r.vehicleId === car.id) });
  const readings = data.readings.filter((r) => r.vehicleId === car.id).sort((a, b) => b.date.localeCompare(a.date) || b.reading - a.reading);
  const monthly = odo.pace ? Math.round((odo.pace * 30.44) / 10) * 10 : null;

  return (
    <div className="flex flex-col gap-6 lg:h-full lg:min-h-0">
      {header}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:min-h-0 lg:flex-1 lg:grid-cols-[340px_minmax(0,1fr)]">
        <div className="flex flex-col gap-6 lg:min-h-0 lg:overflow-y-auto">
          <section className={`${cardClass} px-5 py-4`} aria-label={t('cars.details', { car: car.name })}>
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <h2 className="text-2xl font-semibold text-ink">{car.name}</h2>
                {(car.year || car.make || car.model) && <p className="text-lg text-muted">{[car.year, car.make, car.model].filter(Boolean).join(' ')}</p>}
              </div>
              {may.settings && (
                <button type="button" className={iconButton} onClick={() => open({ kind: 'vehicle', vehicle: car })} aria-label={t('row.edit', { name: car.name })}>
                  <Pencil size={18} />
                </button>
              )}
            </div>
            {car.notes && <p className="mt-2 text-base whitespace-pre-line text-muted">{car.notes}</p>}
          </section>

          <section className={`${cardClass} px-5 py-4`} aria-label={t('odometer.title')}>
            <p className={overline}>{t('odometer.title')}</p>
            {odo.latest ? (
              <p className="mt-1 text-ink">
                <span className="text-4xl font-semibold tracking-tight tabular-nums">{formatReading(odo.latest.reading)}</span>
                <span className="ml-2 text-lg text-muted">{unitWord(unit)}</span>
                <span className="block text-base text-muted">{t('odometer.read', { when: daysAgo(-daysUntil(odo.latest.date, now)) })}</span>
                {monthly && <span className="block text-base text-muted">{t('odometer.monthly', { distance: formatDistance(monthly, unit) })}</span>}
              </p>
            ) : (
              <p className="mt-1 text-base text-muted">{t('odometer.none')}</p>
            )}
            <button type="button" className={`${primaryButton} mt-3 w-full`} onClick={() => open({ kind: 'reading', vehicleId: car.id })}>
              <Gauge size={20} /> {t('odometer.log')}
            </button>
            {readings.length > 0 && (
              <ul className="mt-3 border-t border-line" aria-label={t('odometer.readings')}>
                {readings.slice(0, 4).map((r) => (
                  <li key={r.id} className="flex items-center gap-3 border-b border-line py-1 last:border-b-0">
                    <span className="w-28 shrink-0 text-base text-muted">{formatYmd(r.date)}</span>
                    <span className="min-w-0 flex-1 text-base text-ink tabular-nums">{formatDistance(r.reading, unit)}</span>
                    {may.change(r) && (
                      <button
                        type="button"
                        className={iconButton}
                        aria-label={t('odometer.deleteReading', { reading: formatReading(r.reading), date: formatYmd(r.date) })}
                        onClick={() => notify(t('toast.deletedReading', { reading: formatReading(r.reading) }), actions.deleteReading(r.id))}
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="flex flex-col gap-6 lg:min-h-0 lg:overflow-y-auto">
          <section className={cardClass} aria-label={t('cars.schedule')}>
            <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
              <h3 className="text-xl font-semibold text-ink">{t('cars.schedule')}</h3>
              <button type="button" className={ghostButton} onClick={() => open({ kind: 'item', vehicleId: car.id, item: null })}>
                <CalendarPlus size={18} /> {t('cars.addItem')}
              </button>
            </div>
            {items.length === 0 && asideItems.length === 0 && <p className="px-5 py-4 text-base text-muted">{t('cars.noSchedule')}</p>}
            <ul>
              {items.map((entry) => (
                <UpcomingRow key={entry.id} entry={entry} store={store} unit={unit} now={now} may={may} open={open} notify={notify} showCar={false} />
              ))}
              {asideItems.map((entry) => (
                <SetAsideRow key={entry.id} entry={entry} store={store} unit={unit} may={may} notify={notify} showCar={false} />
              ))}
            </ul>
          </section>

          <section className={cardClass} aria-label={t('cars.renewalsOf', { car: car.name })}>
            <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
              <h3 className="text-xl font-semibold text-ink">{t('tab.renewals')}</h3>
              <button type="button" className={ghostButton} onClick={() => open({ kind: 'renewal', renewal: null, vehicleId: car.id })}>
                <FilePlus size={18} /> {t('renewals.add')}
              </button>
            </div>
            {renewals.length === 0 && asideRenewals.length === 0 && <p className="px-5 py-4 text-base text-muted">{t('cars.noRenewals')}</p>}
            <ul>
              {renewals.map((entry) => (
                <UpcomingRow key={entry.id} entry={entry} store={store} unit={unit} now={now} may={may} open={open} notify={notify} showCar={false} />
              ))}
              {asideRenewals.map((entry) => (
                <SetAsideRow key={entry.id} entry={entry} store={store} unit={unit} may={may} notify={notify} showCar={false} />
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
  const t = useT();
  return (
    <div className="flex items-center gap-2" role="group" aria-label={t('cars.unit')}>
      <span className="text-base text-muted">{t('cars.readIn')}</span>
      {(['mi', 'km'] as const).map((u) => (
        <Chip key={u} active={unit === u} onClick={() => onChange(u)}>
          {capitalize(unitWord(u))}
        </Chip>
      ))}
    </div>
  );
}

