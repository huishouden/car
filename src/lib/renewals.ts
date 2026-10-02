import type { RenewalData, RenewalKind } from './model';
import { nextRenewal, renewalDue as kitRenewalDue, type RenewalState } from '@huishouden/pwa-kit/schedule';
import { daysAgo, daysUntil, formatSpan, inDays, type Ymd } from '@huishouden/pwa-kit/time';

// Renewals with a due date: registration, insurance, the inspection sticker, a toll account.

export type { RenewalState } from '@huishouden/pwa-kit/schedule';

/** Within this many days, a renewal counts as coming up soon. */
export const RENEWAL_SOON_DAYS = 30;

export interface RenewalDue {
  state: RenewalState;
  /** Calendar days to the due date; negative once it has passed. */
  days: number;
}

export const renewalDue = (r: Pick<RenewalData, 'dueDate'>, now: number): RenewalDue => kitRenewalDue(r.dueDate, now, RENEWAL_SOON_DAYS);

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

/** The due date after marking it renewed: the anniversary stays put; null when it doesn't repeat. */
export const nextRenewalDate = (r: Pick<RenewalData, 'dueDate' | 'everyMonths'>, now: number): Ymd | null => nextRenewal(r.dueDate, r.everyMonths, now);

/** Usual repeat for a kind, for the new-renewal form. */
export const DEFAULT_RENEWAL_MONTHS: Record<RenewalKind, number | undefined> = {
  registration: 12,
  insurance: 6,
  inspection: 12,
  toll: 12,
  other: undefined,
};
