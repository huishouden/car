import { FilePlus } from 'lucide-react';
import { setAside, upcoming } from '../lib/upcoming';
import { useClock } from '@huishouden/pwa-kit/react/clock';
import type { ScreenProps } from '../CarApp';
import { cardClass, primaryButton } from '@huishouden/pwa-kit/react/ui';
import { SetAsideRow, UpcomingRow } from './rows';
import { useT } from '../i18n';

/** Registration, insurance, inspection stickers and toll accounts for every car, soonest first. */
export function Renewals({ store, unit, may, open, notify }: ScreenProps) {
  const t = useT();
  const { now } = useClock();
  const list = upcoming({ ...store.data, serviceItems: [] }, unit, now);
  const closed = setAside({ ...store.data, serviceItems: [] });
  return (
    <div className="mx-auto max-w-4xl space-y-6 lg:h-full lg:overflow-y-auto">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-2xl font-semibold text-ink">{t('tab.renewals')}</h2>
        <button type="button" className={primaryButton} onClick={() => open({ kind: 'renewal', renewal: null })}>
          <FilePlus size={20} /> {t('renewals.add')}
        </button>
      </div>
      <section className={cardClass} aria-label={t('renewals.all')}>
        {list.length === 0 && closed.length === 0 && <p className="p-6 text-lg text-muted">{t('renewals.empty')}</p>}
        <ul>
          {list.map((entry) => (
            <UpcomingRow key={entry.id} entry={entry} store={store} unit={unit} now={now} may={may} open={open} notify={notify} showCar />
          ))}
          {closed.map((entry) => (
            <SetAsideRow key={entry.id} entry={entry} store={store} unit={unit} may={may} notify={notify} showCar />
          ))}
        </ul>
      </section>
    </div>
  );
}
