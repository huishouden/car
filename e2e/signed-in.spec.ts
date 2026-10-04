import { expect, test, type Page } from '@playwright/test';
import { runPortalTodo, useTestHousehold } from '@huishouden/pwa-kit/e2e';
import { addMonths, toYmd } from '@huishouden/pwa-kit/time';

// Signed in as the invented people of a household of this run's own (pwa-kit STANDARD.md
// "Staging"), against the real rules: on the emulators (`bun run e2e:emulator`), and on
// staging for what needs the suite's site (@staging) or a kit bump (@smoke).
const hh = useTestHousehold(test);

const CAR = 'Test car';

/** The Cars screen on the test car, adding it the first time a test of this file gets there. */
async function openTestCar(page: Page) {
  await page.getByRole('button', { name: 'Cars', exact: true }).click({ timeout: 20_000 });
  const chip = page.getByRole('group', { name: 'Car' }).getByRole('button', { name: CAR, exact: true });
  await expect(page.getByRole('button', { name: 'Add car' })).toBeVisible({ timeout: 20_000 });
  if (await chip.isVisible()) await chip.click();
  else {
    await page.getByRole('button', { name: 'Add car' }).click();
    const dialog = page.getByRole('dialog', { name: 'New car' });
    await dialog.getByLabel('Nickname').fill(CAR);
    await dialog.getByRole('button', { name: 'Save' }).click();
  }
  await expect(page.getByRole('heading', { name: CAR })).toBeVisible();
}

/** Logs `reading` on the test car's Odometer and checks it shows. */
async function logReading(page: Page, reading: number) {
  const shown = reading.toLocaleString('en-US');
  await page.getByRole('region', { name: 'Odometer' }).getByRole('button', { name: 'Log odometer' }).click();
  const dialog = page.getByRole('dialog', { name: `Odometer: ${CAR}` });
  await dialog.getByLabel(/^Reading in /).fill(String(reading));
  await dialog.getByRole('button', { name: 'Save reading' }).click();
  await expect(page.getByText(`Logged ${shown} for ${CAR}`)).toBeVisible();
  await expect(page.getByRole('region', { name: 'Odometer' })).toContainText(shown);
  return shown;
}

test('an odometer reading one member logs shows for the other', { tag: '@smoke' }, async ({ browser }) => {
  const page = await hh.open(browser, 'admin');
  await openTestCar(page);
  const shown = await logReading(page, 12_345);

  // Saved in the household, not just on this screen: the other member's own browser shows it.
  const theirs = await hh.open(browser, 'member');
  await openTestCar(theirs);
  await expect(theirs.getByRole('region', { name: 'Odometer' })).toContainText(shown, { timeout: 20_000 });
});

test('a helper can’t add or change a car and is told why, but logs an odometer reading', async ({ browser }) => {
  // The test car exists (added by an admin, as the household would).
  await openTestCar(await hh.open(browser, 'admin'));

  const page = await hh.open(browser, 'helper');
  await page.getByRole('button', { name: 'Cars', exact: true }).click({ timeout: 20_000 });
  // Refused: cars and the unit are the household's settings.
  await expect(page.getByText('Only admins and members can change settings.')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('button', { name: 'Add car' })).toHaveCount(0);
  await page.getByRole('group', { name: 'Car' }).getByRole('button', { name: CAR, exact: true }).click();
  await expect(page.getByRole('button', { name: `Edit ${CAR}` })).toHaveCount(0);

  // Permitted: a reading of their own (above the other test's), which they may also delete.
  const shown = await logReading(page, 12_400);
  await expect(page.getByRole('button', { name: new RegExp(`^Delete reading ${shown} `) }).first()).toBeVisible();
});

// @staging: the portal's To-do list is another app on the suite's site.
test('a renewal due today is renewed from the household to-do list', { tag: '@staging' }, async ({ browser }) => {
  test.setTimeout(150_000);
  const page = await hh.open(browser, 'admin');
  await openTestCar(page);
  const name = 'Test renewal';
  const today = toYmd(Date.now());
  const renewals = page.getByRole('region', { name: `${CAR} renewals` });
  await renewals.getByRole('button', { name: 'Add renewal' }).click();
  const dialog = page.getByRole('dialog', { name: 'New renewal' });
  await dialog.getByRole('button', { name: 'Other', exact: true }).click();
  await dialog.getByLabel('Name').fill(name);
  await dialog.getByLabel('Due on').fill(today);
  await dialog.getByLabel('Repeats').selectOption('12');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(renewals.getByText(`${name} due today`)).toBeVisible();

  // Car stays open (it publishes a few seconds after the change) while the portal, in another tab
  // signed in as the same member, Renews it from the To-do list, as another member would.
  const portal = await hh.open(browser, 'admin', 'about:blank');
  await runPortalTodo(portal, `Renew ${name}`, { timeout: 60_000 });

  // Back in Car the renewal moved a year on from its due date.
  await renewals.getByRole('button', { name: `Edit ${name}` }).click();
  const edit = page.getByRole('dialog', { name: `Edit ${name}` });
  await expect(edit.getByLabel('Due on')).toHaveValue(addMonths(today, 12), { timeout: 20_000 });
  await edit.getByRole('button', { name: 'Cancel' }).click();
});
