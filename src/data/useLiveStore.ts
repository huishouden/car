import { useEffect, useMemo, useRef, useState } from 'react';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { commitOps, setDoc } from '@huishouden/pwa-kit/firestore';
import { householdContacts, markUnflaggedOpen, watchContacts } from '@huishouden/pwa-kit/contacts';
import { can, isRestricted, type Role } from '@huishouden/pwa-kit/roles';
import type { CarData } from '../lib/demo';
import type { SettingsData } from '../lib/model';
import { readError } from '@huishouden/pwa-kit/feedback';
import { APP } from '../lib/contacts';
import { db } from './firebase';
import { COLLECTIONS, applyOps, createActions, type Backend, type CollectionName } from './actions';
import { publishChanges, syncAll, syncTodoList } from './publishAgenda';
import type { CarStore } from './types';
import { t } from '../i18n';

/** How long after a change the to-do list is brought up to date. */
const TODO_DELAY = 3000;

const EMPTY: CarData = { vehicles: [], serviceItems: [], readings: [], renewals: [], serviceLog: [], appointments: [], contacts: [], settings: null };

const WHAT = {
  carVehicles: 'error.loadCars',
  carServiceItems: 'error.loadSchedules',
  carOdometer: 'error.loadReadings',
  carRenewals: 'error.loadRenewals',
  carServiceLog: 'error.loadHistory',
  carAppointments: 'error.loadAppointments',
  settings: 'error.loadSettings',
  contacts: 'error.loadShops',
} as const satisfies Record<CollectionName | 'settings' | 'contacts', string>;

/**
 * Live household data from Firestore with onSnapshot listeners. Writes are fire-and-forget: the
 * persistent cache applies them locally at once (also offline) and syncs later.
 */
export function useLiveStore(householdId: string, me: string, role: Role | null, onError: (message: string) => void): CarStore {
  // Helpers and kids may read only appointments and shops not marked private, and must ask for just those.
  const restricted = isRestricted(role);
  const [data, setData] = useState<CarData>(EMPTY);
  const [answered, setAnswered] = useState<Set<string>>(() => new Set());
  const ref = useRef(data);
  ref.current = data;
  const errorRef = useRef(onError);
  errorRef.current = onError;
  const base = `households/${householdId}`;

  useEffect(() => {
    const answer = (key: string) => setAnswered((a) => (a.has(key) ? a : new Set(a).add(key)));
    const loadFailed = (key: keyof typeof WHAT) => (e: Error) => {
      answer(key);
      errorRef.current(readError(e, t(WHAT[key])));
    };
    const unsubs = (Object.keys(COLLECTIONS) as CollectionName[]).map((col) =>
      onSnapshot(
        restricted && col === 'carAppointments' ? query(collection(db, base, col), where('private', '==', false)) : collection(db, base, col),
        (s) => {
          const list = s.docs.map((d) => ({ id: d.id, ...d.data() }));
          setData((d) => ({ ...d, [COLLECTIONS[col]]: list }));
          answer(col);
        },
        loadFailed(col),
      ),
    );
    unsubs.push(
      onSnapshot(
        doc(db, base, 'carSettings', 'main'),
        (s) => {
          setData((d) => ({ ...d, settings: s.exists() ? (s.data() as SettingsData) : null }));
          answer('settings');
        },
        loadFailed('settings'),
      ),
      watchContacts(
        db,
        householdId,
        (contacts) => {
          setData((d) => ({ ...d, contacts }));
          answer('contacts');
        },
        { app: APP, restricted, onError: loadFailed('contacts') },
      ),
    );
    return () => unsubs.forEach((u) => u());
  }, [base, householdId, restricted]);

  const synced = useRef(false);
  const actions = useMemo(() => {
    const report = (p: Promise<unknown>) => void p.catch((e) => errorRef.current(readError(e, t('error.save'))));
    const backend: Backend = {
      newId: (col) => doc(collection(db, base, col)).id,
      write: (ops) => {
        report(commitOps(db, base, ops));
        const before = ref.current;
        const after = applyOps(before, ops);
        publishChanges(householdId, me, before, after, ops, Date.now(), restricted);
        // At once as well as after the snapshot: someone may close the app right after a tap.
        if (synced.current) syncTodoList(householdId, me, after, Date.now(), restricted);
      },
      saveSettings: (distanceUnit, by, now) => report(setDoc(doc(db, base, 'carSettings', 'main'), { distanceUnit, updatedAt: Math.round(now), updatedBy: by })),
      contacts: householdContacts(db, householdId, APP, me, report),
    };
    return createActions(backend, () => ref.current, me, () => Date.now());
  }, [base, householdId, me, restricted]);

  const ready = (Object.keys(COLLECTIONS) as string[]).every((c) => answered.has(c)) && answered.has('settings');

  // Once per open, with every collection loaded: repairs what another device or an older version
  // left on the household agenda, and moves items whose day has passed to overdue.
  const loaded = ready && answered.has('contacts');
  useEffect(() => {
    if (!loaded || synced.current || !me) return;
    synced.current = true;
    syncAll(householdId, me, ref.current, Date.now(), restricted);
    // Appointments saved before the private flag are hidden from helpers and kids until written
    // with `private: false`: an admin's or member's device does that once.
    if (can(role, 'see-private')) markUnflaggedOpen(db, householdId, 'carAppointments', ref.current.appointments).catch(() => {});
  }, [loaded, householdId, me, restricted, role]);

  // The to-do list follows the data a few seconds after it changes (here or on another device),
  // once the first sync has run.
  useEffect(() => {
    if (!synced.current || !me) return;
    const t = setTimeout(() => syncTodoList(householdId, me, ref.current, Date.now(), restricted), TODO_DELAY);
    return () => clearTimeout(t);
  }, [data, householdId, me, restricted]);

  // A shop renamed or removed changes the appointments that name it.
  const shops = useRef(data.contacts);
  useEffect(() => {
    const before = shops.current;
    shops.current = data.contacts;
    if (synced.current && before !== data.contacts) publishChanges(householdId, me, { ...ref.current, contacts: before }, ref.current, [], Date.now(), restricted);
  }, [data.contacts, householdId, me, restricted]);
  return { data, ready, actions, me, role };
}
