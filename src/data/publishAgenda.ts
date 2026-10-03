import { removeAgenda, replaceAgenda, syncAgenda } from '@huishouden/pwa-kit/agenda';
import { syncTodos } from '@huishouden/pwa-kit/todos';
import { AGENDA_APP, agendaChanges, agendaItems, type Touched } from '../lib/agenda';
import { TODO_APP, todoItems } from '../lib/todos';
import type { CarData } from '../lib/demo';
import { db } from './firebase';

// The household agenda and to-do list from the live store. The agenda is a copy for the portal: a failed write
// here never fails the save, and the next open's sync repairs it.

const warn = (e: unknown) => console.warn("Couldn't update the household agenda", e);
const warnTodos = (e: unknown) => console.warn("Couldn't update the household to-do list", e);

/** Makes Car's items on the household to-do list match the data: on open, and a few seconds after a change. */
export function syncTodoList(householdId: string, by: string, data: CarData, now = Date.now(), restricted = false): void {
  try {
    syncTodos(db, householdId, TODO_APP, todoItems(data, now), { by, now, restricted }).catch(warnTodos);
  } catch (e) {
    warnTodos(e);
  }
}

/** After a write: replaces the items of every record it changed, removes those of deleted ones. */
export function publishChanges(householdId: string, by: string, before: CarData, after: CarData, touched: Touched[], now = Date.now(), restricted = false): void {
  let changes;
  try {
    changes = agendaChanges(before, after, touched, now);
  } catch (e) {
    warn(e);
    return;
  }
  for (const { ref, items } of changes.replace) replaceAgenda(db, householdId, AGENDA_APP, ref, items, { by, now, restricted }).catch(warn);
  for (const ref of changes.remove) removeAgenda(db, householdId, AGENDA_APP, ref, { restricted }).catch(warn);
}

/** On open: makes everything Car has published match the data, and refreshes overdue status. */
export function syncAll(householdId: string, by: string, data: CarData, now = Date.now(), restricted = false): void {
  try {
    syncAgenda(db, householdId, AGENDA_APP, agendaItems(data, now), { by, now, restricted }).catch(warn);
  } catch (e) {
    warn(e);
  }
  syncTodoList(householdId, by, data, now, restricted);
}
