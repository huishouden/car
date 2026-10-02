import type { DistanceUnit } from '../lib/distance';
import { formatYmd, toYmd } from '@huishouden/pwa-kit/time';
import { carOdometer, type UpcomingItem } from '../lib/upcoming';
import { describeMonths } from '@huishouden/pwa-kit/schedule';
import { nextRenewalDate } from '../lib/renewals';
import { describeInterval, describeLast } from '../lib/schedule';
import type { CarStore } from '../data/types';
import type { Notify, Open } from '../CarApp';
import { DueRow, Meta } from '../components/DueRow';

/** A service item or renewal from the upcoming list, with Done / Renewed and Edit wired up. */
export function UpcomingRow({ entry, store, unit, now, open, notify, showCar }: {
  entry: UpcomingItem;
  store: CarStore;
  unit: DistanceUnit;
  now: number;
  open: (o: Open) => void;
  notify: Notify;
  showCar: boolean;
}) {
  const car = entry.vehicle?.name ?? 'All cars';
  if (entry.kind === 'service') {
    const { item } = entry;
    const { data } = store;
    return (
      <DueRow
        kind="service"
        state={entry.state}
        text={entry.text}
        meta={<Meta parts={[showCar && car, describeInterval(item, unit), describeLast(item, unit, now)]} />}
        doneLabel="Done"
        onDone={() =>
          open({
            kind: 'visit',
            visit: null,
            prefill: {
              vehicleId: item.vehicleId,
              serviceItemIds: [item.id],
              what: item.name,
              date: toYmd(now),
              odometer: carOdometer(item.vehicleId, data.readings, data.serviceLog, data.serviceItems).latest?.reading,
            },
          })
        }
        onEdit={() => open({ kind: 'item', vehicleId: item.vehicleId, item })}
        editLabel={`Edit ${item.name}${showCar ? ` for ${car}` : ''}`}
      />
    );
  }
  const { renewal } = entry;
  const next = nextRenewalDate(renewal, now);
  return (
    <DueRow
      kind="renewal"
      state={entry.state}
      text={entry.text}
      meta={<Meta parts={[showCar && car, formatYmd(renewal.dueDate, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }), describeMonths(renewal.everyMonths)]} />}
      doneLabel="Renewed"
      onDone={
        next
          ? () => {
              const undo = store.actions.markRenewed(renewal.id);
              notify(`${renewal.name} next due ${formatYmd(next)}`, undo);
            }
          : undefined
      }
      onEdit={() => open({ kind: 'renewal', renewal })}
      editLabel={`Edit ${renewal.name}${showCar ? ` for ${car}` : ''}`}
    />
  );
}
