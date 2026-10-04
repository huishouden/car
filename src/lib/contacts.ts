import type { Contact } from '@huishouden/pwa-kit/contacts';
import { LANGS, withLang } from '@huishouden/pwa-kit/i18n';
import { t } from '../i18n';

// Shops: the household's shared contacts that Car shows (apps includes 'car'). Grouping, saving
// and the dialog are the kit's (@huishouden/pwa-kit/contacts, /react/contacts).

export const APP = 'car';

/** Roles offered as one-tap choices, in the order the Shops tab shows them. */
export const ROLES = ['mechanic', 'dealer', 'tires', 'bodyShop', 'carWash', 'insurance'] as const;
export type ShopRole = (typeof ROLES)[number];

const ROLE_KEYS = {
  mechanic: 'role.mechanic',
  dealer: 'role.dealer',
  tires: 'role.tires',
  bodyShop: 'role.bodyShop',
  carWash: 'role.carWash',
  insurance: 'role.insurance',
} as const satisfies Record<ShopRole, string>;

/** A one-tap role's name in the page's language ("Mechanic", "Mecánico", "Garage"). */
export const roleLabel = (role: ShopRole): string => t(ROLE_KEYS[role]);

/** The one-tap roles in the page's language, for the contact dialog and grouping. */
export const roleLabels = (): string[] => ROLES.map(roleLabel);

/**
 * The one-tap role whose name `text` is, in any language: a role is stored as chosen, so one saved
 * on a Dutch phone ("Garage") is still the mechanic on a Spanish one. A language whose messages are
 * not loaded yet answers in English.
 */
export function namedRole(text: string | undefined): ShopRole | null {
  const typed = text?.trim().toLowerCase();
  if (!typed) return null;
  return ROLES.find((r) => LANGS.some((l) => withLang(l, () => roleLabel(r)).toLowerCase() === typed)) ?? null;
}

/** Contacts whose role is a one-tap role, shown under that role's name in the page's language. */
export function withShownRoles(contacts: Contact[]): Contact[] {
  return contacts.map((c) => {
    const role = namedRole(c.role);
    return role ? { ...c, role: roleLabel(role) } : c;
  });
}
