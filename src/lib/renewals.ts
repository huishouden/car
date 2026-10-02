import type { RenewalData, RenewalKind } from './model';
import { addMonths, daysAgo, daysUntil, formatSpan, inDays, toYmd, type Ymd } from './time';

// Renewals with a due date: registration, insurance, the inspection sticker, a toll account.

export type RenewalState = 'overdue' | 'soon' | 'ok';

/** Within this many days, a renewal counts as coming up soon. */
export const RENEWAL_SOON_DAYS = 30;

export interface RenewalDue {
  state: RenewalState;
  /** Calendar days to the due date; negative once it has passed. */
  days: number;
}

export function renewalDue(r: Pick<RenewalData, 'dueDate'>, now: number): RenewalDue {
  const days = daysUntil(r.dueDate, now);
  return { state: days < 0 ? 'overdue' : days <= RENEWAL_SOON_DAYS ? 'soon' : 'ok', days };
}

/** Things that lapse "expire"; accounts and policies "renew". */
const EXPIRES: Record<RenewalKind, boolean> = { registration: true, inspection: true, insurance: false, toll: false, other: false };

/**
 * "Registration expires in 12 days", "Registration expired 4 days ago", "Insurance renews in
 * 3 months", "Insurance renewal is 2 weeks overdue", "Emissions test due tomorrow".
 */
export function renewalText(r: Pick<RenewalData, 'kind' | 'name' | 'dueDate'>, now: number): string {
  const days = daysUntil(r.dueDate, now);
  if (r.kind === 'other') return days < 0 ? `${r.name} overdue by ${formatSpan(-days)}` : `${r.name} due ${inDays(days)}`;
  if (EXPIRES[r.kind]) return days < 0 ? `${r.name} expired ${daysAgo(-days)}` : `${r.name} expires ${inDays(days)}`;
  if (days < 0) return `${r.name} renewal is ${formatSpan(-days)} overdue`;
  return `${r.name} renews ${inDays(days)}`;
}

/**
 * The due date after marking it renewed: `everyMonths` on from the old due date (the anniversary
 * stays put), stepping past today if it was renewed very late. Null when it doesn't repeat.
 */
export function nextRenewalDate(r: Pick<RenewalData, 'dueDate' | 'everyMonths'>, now: number): Ymd | null {
  if (!r.everyMonths) return null;
  const today = toYmd(now);
  // Counted from the original date each step, so a 31st stays the 31st where the month has one.
  let k = 1;
  let next = addMonths(r.dueDate, r.everyMonths);
  while (next <= today && k < 1200) next = addMonths(r.dueDate, r.everyMonths * ++k);
  return next;
}

/** "Every year", "Every 6 months", "Every 2 years", or "Once". */
export function describeRenewalInterval(everyMonths: number | undefined): string {
  if (!everyMonths) return 'Once';
  if (everyMonths === 12) return 'Every year';
  if (everyMonths % 12 === 0) return `Every ${everyMonths / 12} years`;
  return everyMonths === 1 ? 'Every month' : `Every ${everyMonths} months`;
}

/** Usual repeat for a kind, for the new-renewal form. */
export const DEFAULT_RENEWAL_MONTHS: Record<RenewalKind, number | undefined> = {
  registration: 12,
  insurance: 6,
  inspection: 12,
  toll: 12,
  other: undefined,
};
