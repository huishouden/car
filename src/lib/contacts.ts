import type { Contact } from '@huishouden/pwa-kit/contacts';
import { LANGS, withLang } from '@huishouden/pwa-kit/i18n';
import { t } from '../i18n';

// Shops: the household's shared contacts that Car shows (apps includes 'car'). Grouping, saving
// and the dialog are the kit's (@huishouden/pwa-kit/contacts, /react/contacts).

export const APP = 'car';

/** Roles offered as one-tap choices, in the order the Shops tab shows them. */
export const ROLES = ['mechanic', 'dealer', 'tires', 'bodyShop', 'carWash', 'gas', 'insurance'] as const;
export type ShopRole = (typeof ROLES)[number];

const ROLE_KEYS = {
  mechanic: 'role.mechanic',
  dealer: 'role.dealer',
  tires: 'role.tires',
  bodyShop: 'role.bodyShop',
  carWash: 'role.carWash',
  gas: 'role.gas',
  insurance: 'role.insurance',
} as const satisfies Record<ShopRole, string>;

/**
 * The one-tap roles as a shop stores them: in English, whoever picks them, so the household's
 * shared contacts group the same in every app and language (pwa-kit docs/i18n.md step 7).
 */
export const ROLE_NAMES = {
  mechanic: 'Mechanic',
  dealer: 'Dealer',
  tires: 'Tires',
  bodyShop: 'Body shop',
  carWash: 'Car wash',
  gas: 'Gas station',
  insurance: 'Insurance',
} as const satisfies Record<ShopRole, string>;

/** The stored names in the Shops tab's order: `ContactDialog`'s and `groupContacts`' roles. */
export const STORED_ROLES: string[] = ROLES.map((r) => ROLE_NAMES[r]);

/** A one-tap role's name in the page's language ("Mechanic", "Mecánico", "Monteur"). */
export const roleLabel = (role: ShopRole): string => t(ROLE_KEYS[role]);

/** A stored role as shown: a one-tap role in the page's language, anything typed as typed. The kit's `roleLabel`. */
export function shownRole(stored: string): string {
  const role = ROLES.find((r) => ROLE_NAMES[r].toLowerCase() === stored.trim().toLowerCase());
  return role ? roleLabel(role) : stored;
}

/**
 * The one-tap role whose name `text` is, in any language, for a role typed as another language's
 * name ("Monteur"). A language whose messages are not loaded yet answers in English.
 */
export function namedRole(text: string | undefined): ShopRole | null {
  const typed = text?.trim().toLowerCase();
  if (!typed) return null;
  return ROLES.find((r) => LANGS.some((l) => withLang(l, () => roleLabel(r)).toLowerCase() === typed)) ?? null;
}

/** Contacts with a one-tap role typed under another language's name read as the stored English role, so they group with the rest. */
export function withStoredRoles(contacts: Contact[]): Contact[] {
  return contacts.map((c) => {
    const role = namedRole(c.role);
    return role && c.role !== ROLE_NAMES[role] ? { ...c, role: ROLE_NAMES[role] } : c;
  });
}
