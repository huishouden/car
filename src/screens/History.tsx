import { useState } from 'react';
import { Pencil, Phone, Wrench } from 'lucide-react';
import { telHref } from '@huishouden/pwa-kit/places';
import { formatDistance } from '../lib/distance';
import { formatCents } from '../lib/money';
import { formatYmd } from '../lib/format';
import { toYmd } from '../lib/time';
import { useClock } from '../clock';
import type { ScreenProps } from '../CarApp';
import { Chip, cardClass, iconButton, linkClass, primaryButton } from '../components/ui';

/** Every service visit, newest first, with what it cost. */
export function History({ store, unit, open }: ScreenProps) {
  const { now } = useClock();
  const { data } = store;
  const [carId, setCarId] = useState<string>('');
  const cars = [...data.vehicles].sort((a, b) => a.createdAt - b.createdAt || a.name.localeCompare(b.name));
  const visits = data.serviceLog.filter((e) => !carId || e.vehicleId === carId).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  const year = toYmd(now).slice(0, 4);
  const thisYear = visits.filter((e) => e.date.startsWith(year));
  const spent = thisYear.reduce((sum, e) => sum + (e.costCents ?? 0), 0);

  return (
    <div className="mx-auto max-w-4xl space-y-6 lg:h-full lg:overflow-y-auto">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-stone-800">History</h2>
          <p className="text-base text-stone-600">
            <span className="font-semibold text-stone-800 tabular-nums">{formatCents(spent)}</span> spent in {year} on {thisYear.length} {thisYear.length === 1 ? 'visit' : 'visits'}
          </p>
        </div>
        <button type="button" className={primaryButton} onClick={() => open({ kind: 'visit', visit: null, prefill: carId ? { vehicleId: carId } : undefined })}>
          <Wrench size={20} /> Log a service
        </button>
      </div>
      {cars.length > 1 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Show">
          <Chip active={!carId} onClick={() => setCarId('')}>
            All cars
          </Chip>
          {cars.map((v) => (
            <Chip key={v.id} active={carId === v.id} onClick={() => setCarId(v.id)}>
              {v.name}
            </Chip>
          ))}
        </div>
      )}
      <section className={cardClass} aria-label="Service history">
        {visits.length === 0 && <p className="p-6 text-lg text-stone-600">No services logged yet. Log one after each visit to the shop.</p>}
        <ul>
          {visits.map((e) => {
            const car = data.vehicles.find((v) => v.id === e.vehicleId);
            const shop = e.shopId ? data.contacts.find((c) => c.id === e.shopId) : undefined;
            const [y, m, d] = e.date.split('-');
            return (
              <li key={e.id} className="flex items-start gap-5 border-b border-stone-200 px-5 py-4 last:border-b-0">
                <div className="flex w-16 shrink-0 flex-col items-center rounded-xl bg-forest-50 py-2 text-forest-700">
                  <span className="text-sm font-medium">{formatYmd(e.date, { month: 'short' })}</span>
                  <span className="text-2xl font-semibold tabular-nums">{Number(d)}</span>
                  <span className="text-sm tabular-nums">{y === year ? '' : y}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-4">
                    <p className="text-xl font-semibold text-stone-800">{e.what}</p>
                    {e.costCents !== undefined && <p className="text-xl font-semibold text-stone-800 tabular-nums">{formatCents(e.costCents)}</p>}
                  </div>
                  <p className="mt-0.5 text-base text-stone-600">
                    {[!carId && car?.name, e.odometer !== undefined && formatDistance(e.odometer, unit), shop?.name].filter(Boolean).join(' · ') || formatYmd(`${y}-${m}-${d}`)}
                  </p>
                  {shop?.phone && (
                    <a className={`${linkClass} tabular-nums`} href={telHref(shop.phone)} aria-label={`Call ${shop.name}, ${shop.phone}`}>
                      <Phone size={16} aria-hidden="true" /> {shop.phone}
                    </a>
                  )}
                  {e.notes && <p className="mt-1 text-base whitespace-pre-line text-stone-600">{e.notes}</p>}
                </div>
                <button type="button" className={iconButton} onClick={() => open({ kind: 'visit', visit: e })} aria-label={`Edit ${e.what} on ${formatYmd(e.date)}`}>
                  <Pencil size={18} />
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
