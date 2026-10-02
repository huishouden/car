import { useMemo, useRef, useState } from 'react';
import { cleanContact } from '@huishouden/pwa-kit/contacts';
import { DEMO_MEMBERS, demoData, type CarData } from '../lib/demo';
import { APP } from '../lib/contacts';
import { applyOps, createActions, type Backend } from './actions';
import type { CarStore } from './types';

/**
 * Sample data kept in memory: the signed-out app is fully clickable, nothing is saved, and a reload
 * starts over. `clock` is the demo's moving "now" (fixed 2031 start plus time since load).
 */
export function useDemoStore(clock: () => number): CarStore {
  const [data, setData] = useState<CarData>(demoData);
  const ref = useRef(data);
  ref.current = data;
  const me = DEMO_MEMBERS[0];

  const actions = useMemo(() => {
    let seq = 0;
    // Applied to the ref at once as well, so an action that reads data right after another sees it.
    const patch = (f: (d: CarData) => CarData) => {
      ref.current = f(ref.current);
      setData(ref.current);
    };
    const backend: Backend = {
      newId: (col) => `local-${col}-${Date.now()}-${seq++}`,
      write: (ops) => patch((d) => applyOps(d, ops)),
      saveSettings: (distanceUnit, by, now) => patch((d) => ({ ...d, settings: { distanceUnit, updatedAt: now, updatedBy: by } })),
      saveContact: (id, input) =>
        patch((d) => {
          const existing = id ? d.contacts.find((c) => c.id === id) : undefined;
          const now = clock();
          const contact = { id: id ?? `local-contact-${seq++}`, ...cleanContact(input), createdAt: existing?.createdAt ?? now, ...(existing ? { updatedAt: now } : {}), by: me };
          return { ...d, contacts: [...d.contacts.filter((c) => c.id !== contact.id), contact] };
        }),
      deleteContact: (c) => patch((d) => ({ ...d, contacts: d.contacts.filter((x) => x.id !== c.id) })),
      restoreContact: (c) => patch((d) => ({ ...d, contacts: [...d.contacts.filter((x) => x.id !== c.id), c].filter((x) => x.apps.includes(APP)) })),
    };
    return createActions(backend, () => ref.current, me, clock);
  }, [clock, me]);

  return { data, ready: true, actions, me };
}
