import { useState } from 'react';
import { Pencil, Phone, Wrench } from 'lucide-react';
import { telHref } from '@huishouden/pwa-kit/places';
import { formatDistance } from '../lib/distance';
import { formatCents } from '@huishouden/pwa-kit/money';
import { formatYmd, toYmd } from '@huishouden/pwa-kit/time';
import { useClock } from '@huishouden/pwa-kit/react/clock';
import type { ScreenProps } from '../CarApp';
import { Chip, cardClass, iconButton, linkClass, primaryButton } from '@huishouden/pwa-kit/react/ui';
import { formatNumber } from '@huishouden/pwa-kit/i18n';
import { useT } from '../i18n';

/** Every service visit, newest first, with what it cost. */
export function History({ store, unit, may, open }: ScreenProps) {
  const t = useT();
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
          <h2 className="text-2xl font-semibold text-ink">{t('tab.history')}</h2>
          <p className="text-base text-muted">
            {/* The amount leads in all three languages, so it keeps its weight. */}
            <span className="font-semibold text-ink tabular-nums">{formatCents(spent)}</span> {t('history.spentIn', { year, n: thisYear.length })}
          </p>
        </div>
        <button type="button" className={primaryButton} onClick={() => open({ kind: 'visit', visit: null, prefill: carId ? { vehicleId: carId } : undefined })}>
          <Wrench size={20} /> {t('visit.log')}
        </button>
      </div>
      {cars.length > 1 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label={t('history.show')}>
          <Chip active={!carId} onClick={() => setCarId('')}>
            {t('cars.all')}
          </Chip>
          {cars.map((v) => (
            <Chip key={v.id} active={carId === v.id} onClick={() => setCarId(v.id)}>
              {v.name}
            </Chip>
          ))}
        </div>
      )}
      <section className={cardClass} aria-label={t('history.list')}>
        {visits.length === 0 && <p className="p-6 text-lg text-muted">{t('history.empty')}</p>}
        <ul>
          {visits.map((e) => {
            const car = data.vehicles.find((v) => v.id === e.vehicleId);
            const shop = e.shopId ? data.contacts.find((c) => c.id === e.shopId) : undefined;
            const [y, m, d] = e.date.split('-');
            return (
              <li key={e.id} className="flex items-start gap-5 border-b border-line px-5 py-4 last:border-b-0">
                <div className="flex w-16 shrink-0 flex-col items-center rounded-xl bg-tint py-2 text-link">
                  <span className="text-sm font-medium">{formatYmd(e.date, { month: 'short' })}</span>
                  <span className="text-2xl font-semibold tabular-nums">{formatNumber(Number(d))}</span>
                  <span className="text-sm tabular-nums">{y === year ? '' : y}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-4">
                    <p className="text-xl font-semibold text-ink">{e.what}</p>
                    {e.costCents !== undefined && <p className="text-xl font-semibold text-ink tabular-nums">{formatCents(e.costCents)}</p>}
                  </div>
                  <p className="mt-0.5 text-base text-muted">
                    {[!carId && car?.name, e.odometer !== undefined && formatDistance(e.odometer, unit), shop?.name].filter(Boolean).join(' · ') || formatYmd(`${y}-${m}-${d}`)}
                  </p>
                  {shop?.phone && (
                    <a className={`${linkClass} tabular-nums`} href={telHref(shop.phone)} aria-label={t('contacts.call', { name: shop.name, phone: shop.phone })}>
                      <Phone size={16} aria-hidden="true" /> {shop.phone}
                    </a>
                  )}
                  {e.notes && <p className="mt-1 text-base whitespace-pre-line text-muted">{e.notes}</p>}
                </div>
                {may.change(e) && (
                  <button type="button" className={iconButton} onClick={() => open({ kind: 'visit', visit: e })} aria-label={t('history.editVisit', { what: e.what, date: formatYmd(e.date) })}>
                    <Pencil size={18} />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
