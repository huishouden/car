import { expect, test, type Browser, type Page } from '@playwright/test';
import { expectPageReads, resetPageReads, useTestHousehold } from '@huishouden/pwa-kit/e2e';
import { testHousehold } from '@huishouden/pwa-kit/staging';

// Read budgets (pwa-kit STANDARD.md "Read budgets"): what opening Car costs a household in
// Firestore reads, on the emulators with a build that counts them (`expectPageReads`), in a fresh
// browser context (a first open, nothing cached). A change that raises a ceiling says why in its
// PR. An invented household: one car with two service items, three odometer readings, two visits,
// two renewals, a shop appointment and a private one (helpers and kids never read it), and three
// contacts (Car's shop, a private one, and another app's).
const NOW = Date.now();
const DAY = 86_400_000;
const ymd = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const { admin } = testHousehold('reads').users;
const s = { createdAt: NOW - 400 * DAY, by: admin.email };
const contact = (id: string, name: string, app: string, priv: boolean) => ({ [`contacts/${id}`]: { name, role: 'Shop', phone: '555-0100', apps: [app], private: priv, ...s } });

const hh = useTestHousehold(test, {
  scope: 'reads',
  docs: {
    'carVehicles/car': { name: 'Test hatchback', make: 'Example', ...s },
    'carServiceItems/oil': { vehicleId: 'car', name: 'Oil change', everyMonths: 6, lastDate: ymd(NOW - 170 * DAY), remind: true, ...s },
    'carServiceItems/tyres': { vehicleId: 'car', name: 'Tyre rotation', everyMonths: 12, lastDate: ymd(NOW - 60 * DAY), ...s },
    'carOdometer/r1': { vehicleId: 'car', date: ymd(NOW - 300 * DAY), reading: 15_000, ...s },
    'carOdometer/r2': { vehicleId: 'car', date: ymd(NOW - 60 * DAY), reading: 20_000, ...s },
    'carOdometer/r3': { vehicleId: 'car', date: ymd(NOW - 5 * DAY), reading: 21_500, ...s },
    'carServiceLog/v1': { vehicleId: 'car', date: ymd(NOW - 60 * DAY), what: 'Tyre rotation', serviceItemIds: ['tyres'], ...s },
    'carServiceLog/v2': { vehicleId: 'car', date: ymd(NOW - 170 * DAY), what: 'Oil change', serviceItemIds: ['oil'], ...s },
    'carRenewals/reg': { vehicleId: 'car', kind: 'registration', name: 'Registration', dueDate: ymd(NOW + 10 * DAY), everyMonths: 12, remind: true, ...s },
    'carRenewals/ins': { vehicleId: 'car', kind: 'insurance', name: 'Insurance', dueDate: ymd(NOW + 90 * DAY), everyMonths: 12, remind: true, ...s },
    'carAppointments/a1': { vehicleId: 'car', title: 'Test shop visit', at: NOW + 3 * DAY, shopId: 'shop', private: false, ...s },
    'carAppointments/a2': { vehicleId: 'car', title: 'Test private visit', at: NOW + 4 * DAY, private: true, ...s },
    ...contact('shop', 'Test Garage', 'car', false),
    ...contact('dealer', 'Test Dealer', 'car', true),
    ...contact('vet', 'Test Vet', 'pet', false),
  },
});

// One open at a time: another open's writes (a sign-in's profile, its publish) would reach this
// page's listeners and be counted as its reads.
test.describe.configure({ mode: 'serial' });

// The to-do list is published again this long after the data last changed (useLiveStore).
const TODO_DELAY_MS = 3000;
const loaded = (page: Page) => expect(page.getByRole('region', { name: 'Test hatchback' })).toBeVisible({ timeout: 30_000 });
const TABS = ['Cars', 'Renewals', 'History', 'Appointments', 'Shops'];

// Each person has used Car before on another device: a first sign-in's own writes are done, so they
// don't land in a measured open as changes its listeners bill.
test.beforeAll(async ({ browser }) => {
  test.setTimeout(120_000);
  for (const as of ['admin', 'helper', 'kid'] as const) {
    const page = await hh.open(browser, as);
    await loaded(page);
    await page.waitForTimeout(TODO_DELAY_MS + 1500);
    await page.close();
  }
});

/**
 * A first open of the Overview, then every other screen in turn, each measured on its own: the
 * screens share the open's listeners, so a screen costs only what it adds (`screens`, by tab).
 */
async function firstOpen(browser: Browser, as: 'admin' | 'helper' | 'kid', max: number, screens: Record<string, number>, label: string) {
  const context = await browser.newContext({ baseURL: test.info().project.use.baseURL });
  try {
    const page = await context.newPage();
    await expectPageReads(
      page,
      async () => {
        await hh.signIn(page, as, './');
        await loaded(page);
      },
      // Past the to-do publish a few seconds after the data is in.
      { max, min: max, label: `${label}, Overview`, settleMs: TODO_DELAY_MS + 1500 },
    );
    for (const tab of TABS) {
      await resetPageReads(page);
      await expectPageReads(page, () => page.getByRole('button', { name: tab, exact: true }).first().click(), { max: screens[tab] ?? 0, min: screens[tab] ?? 0, label: `${label}, ${tab}` });
    }
  } finally {
    await context.close();
  }
}

// Every role's open: the household, every Car collection whole, the settings document (none,
// billed 1), the household's contacts (every app's, filtered on the device), then the agenda's one
// query (the sync on open). The to-dos and the reminders stop before reading on the local preview,
// as their links are http; on the suite's https site a first open with nothing published from the
// device also pays their two queries (2 to-dos and 8 reminders on reads.sdk.ts's data), which
// e2e/reads.sdk.ts budgets. Cars adds the member's notification settings (1, the kit's
// NotificationsCard); every other screen adds nothing.
const SCREENS = { Cars: 1 };

// The admin: the car 1, service items 2, readings 3, renewals 2, visits 2, appointments 2, the
// settings 1, contacts 3 and their pay details (none, billed 1), the household 1, the agenda 1.
test('opening Car and each of its screens, signed in as an admin', async ({ browser }) => {
  await firstOpen(browser, 'admin', 19, SCREENS, 'Car, admin');
});

// A helper: the appointment not marked private only (1), the contacts that aren't private (2), no pay details.
test('opening Car and each of its screens, signed in as a helper: nothing private read', async ({ browser }) => {
  await firstOpen(browser, 'helper', 16, SCREENS, 'Car, helper');
});

// A kid reads as a helper does.
test('opening Car and each of its screens, signed in as a kid: nothing private read', async ({ browser }) => {
  await firstOpen(browser, 'kid', 16, SCREENS, 'Car, kid');
});
