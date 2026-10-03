import { Plus } from 'lucide-react';
import { groupContacts, type Contact } from '@huishouden/pwa-kit/contacts';
import { ContactCard } from '@huishouden/pwa-kit/react/contacts';
import { ROLES } from '../lib/contacts';
import type { ScreenProps } from '../CarApp';
import { cardClass, primaryButton } from '@huishouden/pwa-kit/react/ui';

/** The shops: mechanic, dealer, tires and the rest, one tap from a call or a map. Shared household contacts. */
export function Shops({ store, may, open, notify }: ScreenProps) {
  const onAdd = () => open({ kind: 'contact', contact: null });
  const onEdit = (c: Contact) => open({ kind: 'contact', contact: c });
  const groups = groupContacts(store.data.contacts, ROLES);

  return (
    <div className="space-y-6 lg:h-full lg:overflow-y-auto">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-2xl font-semibold text-ink">Shops</h2>
        <button type="button" className={primaryButton} onClick={onAdd}>
          <Plus size={20} /> Add shop
        </button>
      </div>
      {groups.length === 0 && (
        <p className={`${cardClass} p-6 text-lg text-muted`}>No shops yet. Add the mechanic, dealer and tire shop so their numbers are one tap away.</p>
      )}
      <div className="grid items-start gap-6 md:grid-cols-2">
        {groups.flatMap((g) =>
          g.contacts.map((c) => (
            <ContactCard
              key={c.id}
              contact={c}
              role={g.role}
              onEdit={may.change(c) ? () => onEdit(c) : undefined}
              onDelete={
                may.change(c)
                  ? () => {
                      store.actions.deleteContact(c.id);
                      notify(`Deleted ${c.name}`, () => store.actions.restoreContact(c));
                    }
                  : undefined
              }
            />
          )),
        )}
      </div>
    </div>
  );
}
