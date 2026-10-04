import { CalendarClock, CarFront, ChevronRight, Gauge, MapPin, Plus, Wrench } from 'lucide-react';
import { formatDistance, formatReading, unitWord } from '../lib/distance';
import { useT } from '../i18n';
import { daysAgo, daysUntil, formatDayLong, formatTime, relativeDay } from '@huishouden/pwa-kit/time';
import { carOdometer, needsAttention, upcoming } from '../lib/upcoming';
import { useClock } from '@huishouden/pwa-kit/react/clock';
import { RoleNote } from '@huishouden/pwa-kit/react/roles';
import type { ScreenProps, TabId } from '../CarApp';
import { cardClass, ghostButton, overline, primaryButton, secondaryButton } from '@huishouden/pwa-kit/react/ui';
import { UpcomingRow } from './rows';

/** What needs doing across every car, each car's odometer, and the next appointment. */
export function Overview({ store, unit, may, open, notify, onCar, onOpen }: ScreenProps & { onCar: (id: string) => void; onOpen: (tab: TabId) => void }) {
  const t = useT();
  const { now } = useClock();
  const { data } = store;
  const list = upcoming(data, unit, now);
  const attention = needsAttention(list);
  const next = data.appointments.filter((a) => a.at >= now - 3_600_000).sort((a, b) => a.at - b.at)[0];
  const shop = next?.shopId ? data.contacts.find((c) => c.id === next.shopId) : undefined;
  const nextCar = next?.vehicleId ? data.vehicles.find((v) => v.id === next.vehicleId) : undefined;
  const cars = [...data.vehicles].sort((a, b) => a.createdAt - b.createdAt || a.name.localeCompare(b.name));

  if (cars.length === 0)
    return (
      <section className={`${cardClass} mx-auto max-w-2xl p-8`} aria-label={t('overview.noCars')}>
        <CarFront size={32} className="text-link" aria-hidden="true" />
        <h2 className="mt-3 text-2xl font-semibold text-ink">{t('overview.noCars')}</h2>
        <p className="mt-2 text-lg text-muted">{t('overview.noCarsHint')}</p>
        {may.settings ? (
          <button type="button" className={`${primaryButton} mt-5`} onClick={() => open({ kind: 'vehicle', vehicle: null })}>
            <Plus size={20} /> {t('overview.addCar')}
          </button>
        ) : (
          <RoleNote action="change-settings" className="mt-3" />
        )}
      </section>
    );

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:h-full lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_380px]">
      <section className={`${cardClass} flex min-h-0 flex-col`} aria-label={t('overview.comingUp')}>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-line px-5 py-4">
          <div>
            <h2 className="text-2xl font-semibold text-ink">{t('overview.comingUp')}</h2>
            <p className="text-base text-muted" aria-live="polite">
              {attention === 0 ? t('overview.nothingSoon') : t('overview.attention', { n: attention })}
            </p>
          </div>
          <button type="button" className={primaryButton} onClick={() => open({ kind: 'visit', visit: null })}>
            <Wrench size={20} /> {t('visit.log')}
          </button>
        </div>
        {list.length === 0 && <p className="p-5 text-lg text-muted">{t('overview.empty')}</p>}
        <ul className="min-h-0 flex-1 overflow-y-auto">
          {list.map((entry) => (
            <UpcomingRow key={`${entry.kind}-${entry.id}`} entry={entry} store={store} unit={unit} now={now} may={may} open={open} notify={notify} showCar />
          ))}
        </ul>
      </section>

      <div className="flex min-h-0 flex-col gap-6 lg:overflow-y-auto">
        {cars.map((v) => {
          const odo = carOdometer(v.id, data.readings, data.serviceLog, data.serviceItems);
          const age = odo.latest ? -daysUntil(odo.latest.date, now) : null;
          return (
            <section key={v.id} className={`${cardClass} px-5 py-4`} aria-label={v.name}>
              <button type="button" className="-mx-2 flex min-h-11 w-[calc(100%+1rem)] items-center gap-2 rounded-xl px-2 text-left hover:bg-sunken" onClick={() => onCar(v.id)}>
                <span className="min-w-0 flex-1">
                  <span className="block text-xl font-semibold text-ink">{v.name}</span>
                  {(v.year || v.make || v.model) && <span className="block text-base text-muted">{[v.year, v.make, v.model].filter(Boolean).join(' ')}</span>}
                </span>
                <ChevronRight size={20} className="text-muted" aria-hidden="true" />
              </button>
              <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
                {odo.latest ? (
                  <p className="text-ink">
                    <span className="text-4xl font-semibold tracking-tight tabular-nums">{formatReading(odo.latest.reading)}</span>
                    <span className="ml-2 text-lg text-muted">{unitWord(unit)}</span>
                    {age !== null && <span className="block text-base text-muted">{t('odometer.read', { when: daysAgo(age) })}</span>}
                  </p>
                ) : (
                  <p className="text-base text-muted">{t('overview.noReading')}</p>
                )}
                <button
                  type="button"
                  className={`${secondaryButton} whitespace-nowrap`}
                  onClick={() => open({ kind: 'reading', vehicleId: v.id })}
                  aria-label={odo.latest ? t('odometer.logForLast', { car: v.name, distance: formatDistance(odo.latest.reading, unit) }) : t('odometer.logFor', { car: v.name })}
                >
                  <Gauge size={18} aria-hidden="true" /> {t('odometer.log')}
                </button>
              </div>
            </section>
          );
        })}

        <section className={`${cardClass} px-5 py-4`} aria-label={t('overview.nextAppointment')}>
          <div className="flex items-center justify-between gap-3">
            <p className={overline}>{t('overview.nextAppointment')}</p>
            <button type="button" className={ghostButton} onClick={() => onOpen('appointments')}>
              {t('overview.all')} <ChevronRight size={18} />
            </button>
          </div>
          {next ? (
            <button type="button" className="-mx-2 mt-1 w-[calc(100%+1rem)] rounded-xl px-2 py-1 text-left hover:bg-sunken" onClick={() => may.change(next) && open({ kind: 'appointment', appointment: next })}>
              <p className="text-2xl font-semibold text-ink">{next.title}</p>
              <p className="mt-0.5 text-lg text-ink-soft">
                <span className="font-semibold text-link">{relativeDay(next.at, now)}</span> · {formatDayLong(next.at)}, {formatTime(next.at)}
              </p>
              {(nextCar || shop) && (
                <p className="mt-0.5 flex items-center gap-1.5 text-base text-muted">
                  <CalendarClock size={16} aria-hidden="true" /> {nextCar && shop ? t('overview.carAtShop', { car: nextCar.name, shop: shop.name }) : (nextCar?.name ?? shop?.name)}
                </p>
              )}
              {next.location && !shop && (
                <p className="mt-0.5 flex items-center gap-1.5 text-base text-muted">
                  <MapPin size={16} aria-hidden="true" /> {next.location}
                </p>
              )}
            </button>
          ) : (
            <p className="mt-1 text-base text-muted">{t('appointments.none')}</p>
          )}
        </section>
      </div>
    </div>
  );
}
