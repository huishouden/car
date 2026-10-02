import { FilePlus } from 'lucide-react';
import { upcoming } from '../lib/upcoming';
import { useClock } from '@huishouden/pwa-kit/react/clock';
import type { ScreenProps } from '../CarApp';
import { cardClass, primaryButton } from '@huishouden/pwa-kit/react/ui';
import { UpcomingRow } from './rows';

/** Registration, insurance, inspection stickers and toll accounts for every car, soonest first. */
export function Renewals({ store, unit, may, open, notify }: ScreenProps) {
  const { now } = useClock();
  const list = upcoming({ ...store.data, serviceItems: [] }, unit, now);
  return (
    <div className="mx-auto max-w-4xl space-y-6 lg:h-full lg:overflow-y-auto">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-2xl font-semibold text-stone-800">Renewals</h2>
        <button type="button" className={primaryButton} onClick={() => open({ kind: 'renewal', renewal: null })}>
          <FilePlus size={20} /> Add renewal
        </button>
      </div>
      <section className={cardClass} aria-label="All renewals">
        {list.length === 0 && <p className="p-6 text-lg text-stone-600">No renewals yet. Add the registration, insurance and inspection sticker so none of them lapses.</p>}
        <ul>
          {list.map((entry) => (
            <UpcomingRow key={entry.id} entry={entry} store={store} unit={unit} now={now} may={may} open={open} notify={notify} showCar />
          ))}
        </ul>
      </section>
    </div>
  );
}
