import { can, type Role } from '@huishouden/pwa-kit/roles';

/**
 * What the signed-in person's role allows (pwa-kit `./roles`): helpers and kids keep a log and tick
 * things off, but cars, the unit and other people's records are for admins and members.
 */
export interface May {
  /** Add, edit and delete cars; the distance unit. */
  settings: boolean;
  /** Mark appointments and shops private. */
  seePrivate: boolean;
  /** Change or delete this record: admins and members always, others only what they added. */
  change: (record: { by?: string }) => boolean;
}

export function mayFor(store: { role: Role | null; me: string }): May {
  const others = can(store.role, 'edit-others');
  return {
    settings: can(store.role, 'change-settings'),
    seePrivate: can(store.role, 'see-private'),
    change: (record) => others || (!!record.by && record.by === store.me),
  };
}
