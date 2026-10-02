import { useEffect, useMemo, useRef, useState } from 'react';
import { collection, doc, onSnapshot, setDoc, writeBatch } from 'firebase/firestore';
import { addContact, removeContactFromApp, restoreContact, updateContact, watchContacts, type Contact } from '@huishouden/pwa-kit/contacts';
import type { CarData } from '../lib/demo';
import type { SettingsData } from '../lib/model';
import { readError } from '@huishouden/pwa-kit/feedback';
import { APP } from '../lib/contacts';
import { db } from './firebase';
import { COLLECTIONS, createActions, type Backend, type CollectionName } from './actions';
import type { CarStore } from './types';

const EMPTY: CarData = { vehicles: [], serviceItems: [], readings: [], renewals: [], serviceLog: [], appointments: [], contacts: [], settings: null };

const WHAT: Record<CollectionName | 'settings' | 'contacts', string> = {
  carVehicles: 'the cars',
  carServiceItems: 'the service schedules',
  carOdometer: 'the odometer readings',
  carRenewals: 'the renewals',
  carServiceLog: 'the service history',
  carAppointments: 'the appointments',
  settings: 'the settings',
  contacts: 'the shops',
};

/**
 * Live household data from Firestore with onSnapshot listeners. Writes are fire-and-forget: the
 * persistent cache applies them locally at once (also offline) and syncs later.
 */
export function useLiveStore(householdId: string, me: string, onError: (message: string) => void): CarStore {
  const [data, setData] = useState<CarData>(EMPTY);
  const [answered, setAnswered] = useState<Set<string>>(() => new Set());
  const ref = useRef(data);
  ref.current = data;
  const errorRef = useRef(onError);
  errorRef.current = onError;
  const base = `households/${householdId}`;

  useEffect(() => {
    const answer = (key: string) => setAnswered((a) => (a.has(key) ? a : new Set(a).add(key)));
    const fail = (key: keyof typeof WHAT) => (e: Error) => {
      answer(key);
      errorRef.current(readError(e, `Couldn't load ${WHAT[key]}`));
    };
    const unsubs = (Object.keys(COLLECTIONS) as CollectionName[]).map((col) =>
      onSnapshot(
        collection(db, base, col),
        (s) => {
          const list = s.docs.map((d) => ({ id: d.id, ...d.data() }));
          setData((d) => ({ ...d, [COLLECTIONS[col]]: list }));
          answer(col);
        },
        fail(col),
      ),
    );
    unsubs.push(
      onSnapshot(
        doc(db, base, 'carSettings', 'main'),
        (s) => {
          setData((d) => ({ ...d, settings: s.exists() ? (s.data() as SettingsData) : null }));
          answer('settings');
        },
        fail('settings'),
      ),
      watchContacts(db, householdId, (contacts) => setData((d) => ({ ...d, contacts })), { app: APP, onError: fail('contacts') }),
    );
    return () => unsubs.forEach((u) => u());
  }, [base, householdId]);

  const actions = useMemo(() => {
    const report = (p: Promise<unknown>) => void p.catch((e) => errorRef.current(readError(e, "Couldn't save")));
    const backend: Backend = {
      newId: (col) => doc(collection(db, base, col)).id,
      write: (ops) => {
        const batch = writeBatch(db);
        for (const op of ops) {
          const ref = doc(db, base, op.col, op.id);
          if (op.type === 'set') batch.set(ref, op.data);
          else batch.delete(ref);
        }
        report(batch.commit());
      },
      saveSettings: (distanceUnit, by, now) => report(setDoc(doc(db, base, 'carSettings', 'main'), { distanceUnit, updatedAt: Math.round(now), updatedBy: by })),
      saveContact: (id, input) => report(id ? updateContact(db, householdId, id, input, me) : addContact(db, householdId, input, me)),
      // A shop other apps also show stays for them; Car only stops showing it.
      deleteContact: (c: Contact) => report(removeContactFromApp(db, householdId, c, APP, me)),
      restoreContact: (c: Contact) => report(restoreContact(db, householdId, c)),
    };
    return createActions(backend, () => ref.current, me, () => Date.now());
  }, [base, householdId, me]);

  const ready = (Object.keys(COLLECTIONS) as string[]).every((c) => answered.has(c)) && answered.has('settings');
  return { data, ready, actions, me };
}
