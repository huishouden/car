import { CalendarCheck, CalendarClock, CarFront, History as HistoryIcon, LayoutDashboard, Store } from 'lucide-react';
import type { User } from 'firebase/auth';
import { AppOpening, type AppFrameProps, type OpeningPhase } from '@huishouden/pwa-kit/react/frame';
import { trackView } from '@huishouden/pwa-kit/observability';
import type { Tab } from '@huishouden/pwa-kit/react/ui';
import { useUrlTab } from '@huishouden/pwa-kit/react/url-state';
import { PORTAL_URL } from '../lib/portal';
import { useT } from '../i18n';

export type TabId = 'overview' | 'cars' | 'renewals' | 'history' | 'appointments' | 'shops';

// On phones the four primaries sit in the bottom bar (what is due, then what is booked and done);
// the cars' details and the shops are under More.
const TABS = [
  { id: 'overview', label: 'tab.overview', icon: LayoutDashboard, primary: true },
  { id: 'cars', label: 'tab.cars', icon: CarFront },
  { id: 'renewals', label: 'tab.renewals', short: 'tab.renewalsShort', icon: CalendarClock, primary: true },
  { id: 'history', label: 'tab.history', short: 'tab.historyShort', icon: HistoryIcon, primary: true },
  { id: 'appointments', label: 'tab.appointments', short: 'tab.appointmentsShort', icon: CalendarCheck, primary: true },
  { id: 'shops', label: 'tab.shops', icon: Store },
] as const satisfies readonly (Omit<Tab, 'label' | 'short'> & { id: TabId; label: string; short?: string })[];

/** The tabs' ids, in order: the address's `?tab=` names one of them. */
export const TAB_IDS: readonly TabId[] = TABS.map((x) => x.id);

/** The app bar's tabs, in the page's language. */
export const tabsFor = (t: ReturnType<typeof useT>): Tab[] => TABS.map((x) => ({ ...x, label: t(x.label), short: 'short' in x ? t(x.short) : undefined }));

/** The tab on screen, in the address (`?tab=renewals`), so a reload and Back return to it. */
export const useCarTab = () => useUrlTab(TAB_IDS, 'overview');

/** Who is signed in and the app bar's sign-in controls. `user` is undefined while the session restores. */
export interface Account {
  user: User | null | undefined;
  signingIn: boolean;
  onSignIn: () => void;
  onSignOut: () => void;
}

const VERSION = `${import.meta.env.VITE_APP_VERSION} (${import.meta.env.VITE_BUILD_SHA})`;

/**
 * Car's frame (the kit's `AppFrame`): the same props while the app opens and once it has loaded, so
 * nothing moves between them. Without `tab`, no tabs (a note outside the app's sections).
 */
export function carFrame(t: ReturnType<typeof useT>, account: Account, tab?: { id: TabId; choose: (id: TabId) => void }): AppFrameProps {
  return {
    app: t('app.name'),
    glyph: 'car',
    portalUrl: PORTAL_URL,
    version: VERSION,
    ...account,
    // Counts which tabs are used (anonymous, per visit; see the portal's /privacy page); never while opening.
    onView: trackView,
    layout: 'fit',
    ...(tab && { tabs: tabsFor(t), tab: tab.id, onTab: (id: string) => tab.choose(id as TabId) }),
  };
}

/** The app while it opens: the kit's opening frame with Car's tabs and the one in the address. */
export function CarOpening({ phase, ...account }: Account & { phase: OpeningPhase }) {
  const t = useT();
  const [tab, setTab] = useCarTab();
  return <AppOpening {...carFrame(t, account, { id: tab, choose: setTab })} phase={phase} />;
}
