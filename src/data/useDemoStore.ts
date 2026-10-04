import { useMemo, useState } from 'react';
import { sampleContacts } from '@huishouden/pwa-kit/contacts';
import { localIds } from '@huishouden/pwa-kit/store';
import { useSampleStore } from '@huishouden/pwa-kit/react/store';
import { DEMO_MEMBERS, demoData, type CarData } from '../lib/demo';
import { COLLECTIONS, createActions, type Backend, type CollectionName } from './actions';
import type { CarStore } from './types';
import type { Role } from '@huishouden/pwa-kit/roles';

/** `?role=helper` (or kid) previews the sample as the household's helper would see it; otherwise an admin. */
function previewRole(): Role {
  const r = new URLSearchParams(location.search).get('role');
  return r === 'helper' || r === 'kid' || r === 'member' ? r : 'admin';
}

/**
 * Sample data kept in memory: the signed-out app is fully clickable, nothing is saved, and a reload
 * starts over. `clock` is the demo's moving "now" (fixed 2031 start plus time since load).
 */
export function useDemoStore(clock: () => number): CarStore {
  const { data, read, patch, backend: memory } = useSampleStore<CarData, CollectionName>(() => demoData(), (col) => COLLECTIONS[col]);
  const [role] = useState(previewRole);
  const me = role === 'admin' ? DEMO_MEMBERS[0] : 'jo@example.com';

  const actions = useMemo(() => {
    const backend: Backend = {
      ...memory,
      saveSettings: (distanceUnit, by, now) => patch((d) => ({ ...d, settings: { distanceUnit, updatedAt: now, updatedBy: by } })),
      contacts: sampleContacts(() => read().contacts, (contacts) => patch((d) => ({ ...d, contacts })), { by: me, now: clock, newId: localIds() }),
    };
    return createActions(backend, read, me, clock);
  }, [clock, me, memory, patch, read]);

  return { data, ready: true, actions, me, role };
}
