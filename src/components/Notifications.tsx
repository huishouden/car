import { useState } from 'react';
import { Bell } from 'lucide-react';
import { NotificationsCard } from '@huishouden/pwa-kit/react/push';
import { Checkbox, cardClass, overline, primaryButton } from '@huishouden/pwa-kit/react/ui';
import { db } from '../data/firebase';
import { useT } from '../i18n';

/** The VAPID key the shared sender signs with; without it the card says notifications aren't set up. */
export const VAPID_PUBLIC_KEY: string = import.meta.env.VITE_VAPID_PUBLIC_KEY ?? '';

/**
 * "Notifications on this device": the kit's switch with Car's words, and for the signed-in member
 * a "Mute car reminders for me" that leaves everyone else's alone. The sample shows the card with a
 * note instead of a switch that would do nothing.
 */
export function DeviceNotifications({ live }: { live?: { householdId: string; email: string } }) {
  const t = useT();
  const [sampleMuted, setSampleMuted] = useState(false);
  if (live)
    return (
      <NotificationsCard
        db={db}
        householdId={live.householdId}
        user={{ email: live.email }}
        app="car"
        vapidKey={VAPID_PUBLIC_KEY}
        offText={t('push.offText')}
        onText={t('push.onText')}
        muteText={t('push.mute')}
      />
    );
  return (
    <section className={`${cardClass} p-6`} aria-label={t('push.title')}>
      <h3 className={overline}>{t('push.title')}</h3>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <p className="min-w-0 flex-1 text-base text-muted">{t('push.offText')}</p>
        <button type="button" className={primaryButton} disabled>
          <Bell size={18} /> {t('push.turnOn')}
        </button>
      </div>
      <p className="mt-2 text-sm text-muted">{t('push.sampleNote')}</p>
      <div className="mt-3">
        <Checkbox checked={sampleMuted} onChange={setSampleMuted}>
          {t('push.mute')}
        </Checkbox>
        <p className="ml-9 text-sm text-muted">{t('push.muteHint')}</p>
      </div>
    </section>
  );
}
