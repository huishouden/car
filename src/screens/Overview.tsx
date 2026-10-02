import { CalendarClock, CarFront, ChevronRight, Gauge, MapPin, Plus, Wrench } from 'lucide-react';
import { formatDistance, formatReading, UNIT_NAMES } from '../lib/distance';
import { formatDayLong, formatTime } from '../lib/format';
import { carOdometer, needsAttention, upcoming } from '../lib/upcoming';
import { daysAgo, daysUntil, relativeDay } from '../lib/time';
import { useClock } from '../clock';
import type { ScreenProps, TabId } from '../CarApp';
import { cardClass, ghostButton, overline, primaryButton, secondaryButton } from '../components/ui';
import { UpcomingRow } from './rows';

/** What needs doing across every car, each car's odometer, and the next appointment. */
export function Overview({ store, unit, open, notify, onCar, onOpen }: ScreenProps & { onCar: (id: string) => void; onOpen: (tab: TabId) => void }) {
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
      <section className={`${cardClass} mx-auto max-w-2xl p-8`} aria-label="No cars yet">
        <CarFront size={32} className="text-forest-700" aria-hidden="true" />
        <h2 className="mt-3 text-2xl font-semibold text-stone-800">No cars yet</h2>
        <p className="mt-2 text-lg text-stone-600">Add a car to see when its oil change, inspection and registration are due.</p>
        <button type="button" className={`${primaryButton} mt-5`} onClick={() => open({ kind: 'vehicle', vehicle: null })}>
          <Plus size={20} /> Add a car
        </button>
      </section>
    );

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:h-full lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_380px]">
      <section className={`${cardClass} flex min-h-0 flex-col`} aria-label="Coming up">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-stone-200 px-5 py-4">
          <div>
            <h2 className="text-2xl font-semibold text-stone-800">Coming up</h2>
            <p className="text-base text-stone-600" aria-live="polite">
              {attention === 0 ? 'Nothing needs doing in the next month.' : `${attention} ${attention === 1 ? 'thing needs' : 'things need'} doing soon`}
            </p>
          </div>
          <button type="button" className={primaryButton} onClick={() => open({ kind: 'visit', visit: null })}>
            <Wrench size={20} /> Log a service
          </button>
        </div>
        {list.length === 0 && <p className="p-5 text-lg text-stone-600">No schedule or renewals yet. Add them from Cars and Renewals.</p>}
        <ul className="min-h-0 flex-1 overflow-y-auto">
          {list.map((entry) => (
            <UpcomingRow key={`${entry.kind}-${entry.id}`} entry={entry} store={store} unit={unit} now={now} open={open} notify={notify} showCar />
          ))}
        </ul>
      </section>

      <div className="flex min-h-0 flex-col gap-6 lg:overflow-y-auto">
        {cars.map((v) => {
          const odo = carOdometer(v.id, data.readings, data.serviceLog, data.serviceItems);
          const age = odo.latest ? -daysUntil(odo.latest.date, now) : null;
          return (
            <section key={v.id} className={`${cardClass} px-5 py-4`} aria-label={v.name}>
              <button type="button" className="-mx-2 flex min-h-11 w-[calc(100%+1rem)] items-center gap-2 rounded-xl px-2 text-left hover:bg-stone-50" onClick={() => onCar(v.id)}>
                <span className="min-w-0 flex-1">
                  <span className="block text-xl font-semibold text-stone-800">{v.name}</span>
                  {(v.year || v.make || v.model) && <span className="block text-base text-stone-600">{[v.year, v.make, v.model].filter(Boolean).join(' ')}</span>}
                </span>
                <ChevronRight size={20} className="text-stone-600" aria-hidden="true" />
              </button>
              <div className="mt-2 flex items-end justify-between gap-3">
                {odo.latest ? (
                  <p className="text-stone-800">
                    <span className="text-4xl font-semibold tracking-tight tabular-nums">{formatReading(odo.latest.reading)}</span>
                    <span className="ml-2 text-lg text-stone-600">{UNIT_NAMES[unit].many}</span>
                    <span className="block text-base text-stone-600">Read {age === null ? '' : daysAgo(age)}</span>
                  </p>
                ) : (
                  <p className="text-base text-stone-600">No odometer reading yet.</p>
                )}
                <button
                  type="button"
                  className={`${secondaryButton} whitespace-nowrap`}
                  onClick={() => open({ kind: 'reading', vehicleId: v.id })}
                  aria-label={`Log odometer for ${v.name}${odo.latest ? `, last ${formatDistance(odo.latest.reading, unit)}` : ''}`}
                >
                  <Gauge size={18} aria-hidden="true" /> Log odometer
                </button>
              </div>
            </section>
          );
        })}

        <section className={`${cardClass} px-5 py-4`} aria-label="Next appointment">
          <div className="flex items-center justify-between gap-3">
            <p className={overline}>Next appointment</p>
            <button type="button" className={ghostButton} onClick={() => onOpen('appointments')}>
              All <ChevronRight size={18} />
            </button>
          </div>
          {next ? (
            <button type="button" className="-mx-2 mt-1 w-[calc(100%+1rem)] rounded-xl px-2 py-1 text-left hover:bg-stone-50" onClick={() => open({ kind: 'appointment', appointment: next })}>
              <p className="text-2xl font-semibold text-stone-800">{next.title}</p>
              <p className="mt-0.5 text-lg text-stone-700">
                <span className="font-semibold text-forest-700">{relativeDay(next.at, now)}</span> · {formatDayLong(next.at)}, {formatTime(next.at)}
              </p>
              {(nextCar || shop) && (
                <p className="mt-0.5 flex items-center gap-1.5 text-base text-stone-600">
                  <CalendarClock size={16} aria-hidden="true" /> {[nextCar?.name, shop?.name].filter(Boolean).join(' at ')}
                </p>
              )}
              {next.location && !shop && (
                <p className="mt-0.5 flex items-center gap-1.5 text-base text-stone-600">
                  <MapPin size={16} aria-hidden="true" /> {next.location}
                </p>
              )}
            </button>
          ) : (
            <p className="mt-1 text-base text-stone-600">No appointments coming up.</p>
          )}
        </section>
      </div>
    </div>
  );
}
