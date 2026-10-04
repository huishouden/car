import { Plus } from 'lucide-react';
import { groupContacts, type Contact } from '@huishouden/pwa-kit/contacts';
import { ContactCard } from '@huishouden/pwa-kit/react/contacts';
import { STORED_ROLES, shownRole, withStoredRoles } from '../lib/contacts';
import { useT } from '../i18n';
import type { ScreenProps } from '../CarApp';
import { cardClass, primaryButton } from '@huishouden/pwa-kit/react/ui';

/** The shops: mechanic, dealer, tires and the rest, one tap from a call or a map. Shared household contacts. */
export function Shops({ store, may, open, notify }: ScreenProps) {
  const onAdd = () => open({ kind: 'contact', contact: null });
  const onEdit = (c: Contact) => open({ kind: 'contact', contact: c });
  const t = useT();
  // Edits and undo keep the role exactly as stored.
  const stored = new Map(store.data.contacts.map((c) => [c.id, c]));
  const groups = groupContacts(withStoredRoles(store.data.contacts), STORED_ROLES, shownRole);

  return (
    <div className="space-y-6 lg:h-full lg:overflow-y-auto">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-2xl font-semibold text-ink">{t('tab.shops')}</h2>
        <button type="button" className={primaryButton} onClick={onAdd}>
          <Plus size={20} /> {t('shops.add')}
        </button>
      </div>
      {groups.length === 0 && (
        <p className={`${cardClass} p-6 text-lg text-muted`}>{t('shops.empty')}</p>
      )}
      <div className="grid items-start gap-6 md:grid-cols-2">
        {groups.flatMap((g) =>
          g.contacts.map((shown) => {
            const c = stored.get(shown.id) ?? shown;
            return (
            <ContactCard
              key={c.id}
              contact={c}
              role={shownRole(g.role)}
              onEdit={may.change(c) ? () => onEdit(c) : undefined}
              onDelete={
                may.change(c)
                  ? () => {
                      store.actions.deleteContact(c.id);
                      notify(t('common.deleted', { name: c.name }), () => store.actions.restoreContact(c));
                    }
                  : undefined
              }
            />
            );
          }),
        )}
      </div>
    </div>
  );
}
