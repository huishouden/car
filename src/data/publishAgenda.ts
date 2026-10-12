import type { Firestore } from 'firebase/firestore';
import { localizeAgenda, removeAgenda, replaceAgenda, syncAgenda } from '@huishouden/pwa-kit/agenda';
import { localizeReminders, syncReminders } from '@huishouden/pwa-kit/reminders';
import { localizeTodos, syncTodos } from '@huishouden/pwa-kit/todos';
import { AGENDA_APP, agendaByRef, agendaChanges, agendaItems, type Touched } from '../lib/agenda';
import { carReminders } from '../lib/reminders';
import { TODO_APP, todoItems } from '../lib/todos';
import type { CarData } from '../lib/demo';

// The household agenda, to-do list and reminders from the live store, as functions of a Firestore
// so each is read-budgeted on the emulators (e2e/reads.sdk.ts). The agenda is a copy for the
// portal: a failed write here never fails the save, and the next open's sync repairs it.

const warn = (e: unknown) => console.warn("Couldn't update the household agenda", e);
const warnTodos = (e: unknown) => console.warn("Couldn't update the household to-do list", e);

type Published = NonNullable<Parameters<typeof syncAgenda>[4]['published']>;

export interface PublishOptions {
  /** A helper's or kid's device: only what they may read and write. */
  restricted?: boolean;
  /** Where this device notes what it published (default localStorage; null reads every time). */
  published?: Published | null;
  /** Hears a failure (default: a console warning); the publish never throws. */
  onError?: (e: unknown) => void;
  /** The app's address (tests: the suite's own, which the rules require). */
  appUrl?: string;
}

const publishedOf = ({ published }: PublishOptions) => (published === undefined ? {} : { published });
const urlOf = ({ appUrl }: PublishOptions) => (appUrl === undefined ? [] : [appUrl]);

/** Makes Car's items on the household to-do list match the data (one query): on open, and a few seconds after a change. */
export async function syncTodoList(db: Firestore, householdId: string, by: string, data: CarData, now: number, options: PublishOptions = {}): Promise<void> {
  const { restricted = false, onError = warnTodos } = options;
  try {
    // Each to-do carries its words in every language; each member's portal shows their own.
    const items = await localizeTodos(() => todoItems(data, now, ...urlOf(options)));
    await syncTodos(db, householdId, TODO_APP, items, { by, now, restricted, ...publishedOf(options) });
  } catch (e) {
    onError(e);
  }
}

/**
 * After a write: replaces the items of every record it changed (one query each), removes those of
 * deleted ones (one query each), one after the other.
 */
export async function publishChanges(db: Firestore, householdId: string, by: string, before: CarData, after: CarData, touched: Touched[], now: number, options: PublishOptions = {}): Promise<void> {
  const { restricted = false, onError = warn } = options;
  let changes;
  try {
    changes = agendaChanges(before, after, touched, now, ...urlOf(options));
  } catch (e) {
    onError(e);
    return;
  }
  for (const { ref } of changes.replace)
    await localizeAgenda(() => agendaByRef(after, now, ...urlOf(options)).get(ref) ?? [])
      .then((items) => replaceAgenda(db, householdId, AGENDA_APP, ref, items, { by, now, restricted }))
      .catch(onError);
  for (const ref of changes.remove) await removeAgenda(db, householdId, AGENDA_APP, ref, { restricted }).catch(onError);
}

/** On open: makes everything Car has put on the agenda match the data (one query), then the to-do list (one query). */
export async function syncAll(db: Firestore, householdId: string, by: string, data: CarData, now: number, options: PublishOptions = {}): Promise<void> {
  const { restricted = false, onError = warn } = options;
  try {
    const items = await localizeAgenda(() => agendaItems(data, now, ...urlOf(options)));
    await syncAgenda(db, householdId, AGENDA_APP, items, { by, now, restricted, ...publishedOf(options) });
  } catch (e) {
    onError(e);
  }
  await syncTodoList(db, householdId, by, data, now, options);
}

/** The reminders for renewals and service items, from everything loaded (one query). Throws on failure. */
export async function publishReminders(db: Firestore, householdId: string, by: string, data: CarData, now: number, options: Omit<PublishOptions, 'onError' | 'appUrl'> = {}) {
  const items = await localizeReminders(() => carReminders(data, now));
  return syncReminders(db, householdId, AGENDA_APP, items, by, now, { restricted: options.restricted ?? false, ...publishedOf(options) });
}
