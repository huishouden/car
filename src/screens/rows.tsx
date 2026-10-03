import type { DistanceUnit } from '../lib/distance';
import { formatYmd, toYmd } from '@huishouden/pwa-kit/time';
import { carOdometer, type SetAsideItem, type UpcomingItem } from '../lib/upcoming';
import { FileText, RotateCcw, Wrench } from 'lucide-react';
import { secondaryButton } from '@huishouden/pwa-kit/react/ui';
import { describeMonths } from '@huishouden/pwa-kit/schedule';
import { nextRenewalDate } from '../lib/renewals';
import { describeInterval, describeLast } from '../lib/schedule';
import type { CarStore } from '../data/types';
import type { May, Notify, Open } from '../CarApp';
import { DueRow, Meta } from '../components/DueRow';

const formatDayShort = (ms: number) => formatYmd(toYmd(ms), { day: 'numeric', month: 'short' });

/** A service item or renewal from the upcoming list, with Done / Renewed and Edit wired up. */
export function UpcomingRow({ entry, store, unit, now, may, open, notify, showCar }: {
  entry: UpcomingItem;
  may: May;
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
        onEdit={may.change(item) ? () => open({ kind: 'item', vehicleId: item.vehicleId, item }) : undefined}
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
      onEdit={may.change(renewal) ? () => open({ kind: 'renewal', renewal }) : undefined}
      editLabel={`Edit ${renewal.name}${showCar ? ` for ${car}` : ''}`}
    />
  );
}

/** A paused service item or a closed renewal: kept where it was, marked, with Resume / Reopen. */
export function SetAsideRow({ entry, store, unit, may, notify, showCar }: {
  entry: SetAsideItem;
  may: May;
  store: CarStore;
  unit: DistanceUnit;
  notify: Notify;
  showCar: boolean;
}) {
  const car = entry.vehicle?.name ?? 'All cars';
  const service = entry.kind === 'service';
  const record = service ? entry.item : entry.renewal;
  const name = record.name;
  const label = service ? 'Paused' : 'Closed';
  const Icon = service ? Wrench : FileText;
  const restore = () =>
    service
      ? notify(`Resumed ${name}`, store.actions.resumeServiceItem(entry.id))
      : notify(`Reopened ${name}`, store.actions.reopenRenewal(entry.id));
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-stone-200 px-4 py-3 last:border-b-0 sm:flex-nowrap sm:px-5">
      <Icon size={22} strokeWidth={2.2} className="shrink-0 text-stone-400" aria-hidden="true" />
      <div className="min-w-0 flex-1 basis-[calc(100%-2.5rem)] sm:basis-0">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <p className="text-lg font-semibold text-stone-600">{name}</p>
          <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-sm font-medium text-stone-700">{label}</span>
        </div>
        <p className="mt-0.5 text-base text-stone-600">
          <Meta
            parts={[
              showCar && car,
              `${label} ${formatDayShort(entry.at)}`,
              entry.kind === 'service' ? describeInterval(entry.item, unit) : describeMonths(entry.renewal.everyMonths),
            ]}
          />
        </p>
      </div>
      {may.change(record) && (
        <div className="ml-9.5 flex items-center gap-1 sm:ml-0">
          <button type="button" className={secondaryButton} onClick={restore} aria-label={`${service ? 'Resume' : 'Reopen'} ${name}${showCar ? ` for ${car}` : ''}`}>
            <RotateCcw size={18} aria-hidden="true" /> {service ? 'Resume' : 'Reopen'}
          </button>
        </div>
      )}
    </li>
  );
}
