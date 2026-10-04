import { useState } from 'react';
import { Check, MapPin, Plus } from 'lucide-react';
import type { Contact } from '@huishouden/pwa-kit/contacts';
import { formatFromHome } from '@huishouden/pwa-kit/home';
import { formatDistance, PlaceSearchUnavailable, type Place } from '@huishouden/pwa-kit/places';
import { useHome } from '@huishouden/pwa-kit/react/home';
import { cardClass, Chip, ErrorNotice, linkClass, secondaryButton } from '@huishouden/pwa-kit/react/ui';
import { roleLabel } from '../lib/contacts';
import { findNearHome, NEARBY_KINDS, NEARBY_RADIUS_KM, savedAs, type NearbyKind } from '../lib/nearby';
import { PORTAL_URL } from '../lib/portal';
import { useT } from '../i18n';

type Search =
  | { status: 'idle' }
  | { status: 'searching'; kind: NearbyKind }
  | { status: 'done'; kind: NearbyKind; places: Place[] }
  | { status: 'error'; kind: NearbyKind; message: string };

/**
 * Shops near home: a tap on a kind (mechanic, tires, car wash, gas) lists the nearest few around the
 * household's home, each with its distance and Add. Without a home, admins and members get one line
 * pointing to the portal's Household panel; everyone else sees nothing.
 */
export function NearHome({ contacts, canSetHome, onAdd, search = findNearHome }: {
  contacts: readonly Contact[];
  /** Admins and members, who can set the home in the portal. */
  canSetHome: boolean;
  onAdd: (place: Place, kind: NearbyKind) => void;
  /** For tests: stands in for the map search. */
  search?: (kind: NearbyKind) => Promise<Place[]>;
}) {
  const t = useT();
  const home = useHome();
  const [state, setState] = useState<Search>({ status: 'idle' });

  if (!home)
    return canSetHome ? (
      <div className="flex items-start gap-2 text-base text-muted" data-testid="near-home-hint">
        <MapPin size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
        <div>
          <p>{t('nearby.noHome')}</p>
          <a className={linkClass} href={`${PORTAL_URL}#household`}>
            {t('nearby.setHome')}
          </a>
        </div>
      </div>
    ) : null;

  const run = async (kind: NearbyKind) => {
    setState({ status: 'searching', kind });
    try {
      setState({ status: 'done', kind, places: await search(kind) });
    } catch (e) {
      setState({ status: 'error', kind, message: e instanceof PlaceSearchUnavailable ? e.message : t('contacts.osmUnreachable') });
    }
  };

  const active = state.status === 'idle' ? null : state.kind;

  return (
    <section className={`${cardClass} p-5`} aria-labelledby="near-home-title">
      <h3 id="near-home-title" className="text-xl font-semibold text-ink">
        {t('nearby.title')}
      </h3>
      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label={t('nearby.kinds')}>
        {NEARBY_KINDS.map((k) => (
          <Chip key={k.id} active={active?.id === k.id} onClick={() => void run(k)}>
            {roleLabel(k.role)}
          </Chip>
        ))}
      </div>
      <div className="mt-3" aria-live="polite">
        {state.status === 'idle' && <p className="text-base text-muted">{t('nearby.hint')}</p>}
        {state.status === 'searching' && <p className="text-base text-muted">{t('nearby.searching')}</p>}
        {state.status === 'error' && <ErrorNotice message={state.message} onRetry={() => void run(state.kind)} />}
        {state.status === 'done' && state.places.length === 0 && (
          <p role="status" className="text-base text-muted">
            {t('nearby.none', { distance: formatDistance(NEARBY_RADIUS_KM) })}
          </p>
        )}
        {state.status === 'done' && state.places.length > 0 && (
          <ul className="divide-y divide-line" aria-label={t('nearby.results', { kind: roleLabel(state.kind.role) })}>
            {state.places.map((p) => {
              const saved = savedAs(p, contacts);
              return (
                <li key={p.osmUrl} className="flex min-h-11 items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <a
                      className="font-medium text-ink underline-offset-4 [overflow-wrap:anywhere] hover:underline"
                      href={p.mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={t('nearby.map', { name: p.name })}
                    >
                      {p.name}
                    </a>
                    <p className="text-sm text-muted [overflow-wrap:anywhere]">{[formatFromHome(p), p.address].filter(Boolean).join(' · ')}</p>
                    {saved && (
                      <p className="flex items-center gap-1 text-sm text-muted">
                        <Check size={16} aria-hidden="true" /> {t('nearby.saved')}
                      </p>
                    )}
                  </div>
                  {!saved && (
                    <button type="button" className={`${secondaryButton} shrink-0`} onClick={() => onAdd(p, state.kind)} aria-label={t('nearby.add', { name: p.name })}>
                      <Plus size={18} aria-hidden="true" /> {t('common.add')}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-2 text-xs text-muted">{t('nearby.source')}</p>
      </div>
    </section>
  );
}
