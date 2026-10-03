import { expect, test, type Page } from '@playwright/test';
import { runPortalTodo, signInTestUser } from '@huishouden/pwa-kit/e2e';
import { addMonths, toYmd } from '@huishouden/pwa-kit/time';
import { seedTestHousehold } from '@huishouden/pwa-kit/staging';

// Signed in as an invented test user on the staging site (pwa-kit STANDARD.md "Staging"): the real
// staging Firestore and rules, the seeded test household. Other runs share that household, so each
// test writes a value unique to its run and looks for exactly that.
test.skip(!process.env.HH_STAGING_SA, 'signed-in tests run against staging, in CI');

const CAR = 'Test car';
/** Time for a publish to the household to-do list to reach the server before the page is left. */
const PUBLISH_MS = 5_000;

/**
 * The Cars screen on the test car, which is added the first time the household runs this.
 * Resolves true when this call added it.
 */
async function openTestCar(page: Page): Promise<boolean> {
  await page.getByRole('button', { name: 'Cars', exact: true }).click({ timeout: 20_000 });
  const chip = page.getByRole('group', { name: 'Car' }).getByRole('button', { name: CAR, exact: true });
  await expect(page.getByRole('button', { name: 'Add car' })).toBeVisible({ timeout: 20_000 });
  let added = false;
  if (await chip.isVisible()) await chip.click();
  else {
    await page.getByRole('button', { name: 'Add car' }).click();
    const dialog = page.getByRole('dialog', { name: 'New car' });
    await dialog.getByLabel('Nickname').fill(CAR);
    await dialog.getByRole('button', { name: 'Save' }).click();
    added = true;
  }
  await expect(page.getByRole('heading', { name: CAR })).toBeVisible();
  return added;
}

test('a renewal due today is renewed from the household to-do list', async ({ page }) => {
  test.setTimeout(150_000);
  await signInTestUser(page, { email: 'test-a@example.com' });
  const addedCar = await openTestCar(page);
  const name = `E2E renewal ${Date.now().toString(36)}`;
  const today = toYmd(Date.now());
  const renewals = page.getByRole('region', { name: `${CAR} renewals` });
  try {
    await renewals.getByRole('button', { name: 'Add renewal' }).click();
    const dialog = page.getByRole('dialog', { name: 'New renewal' });
    await dialog.getByRole('button', { name: 'Other', exact: true }).click();
    await dialog.getByLabel('Name').fill(name);
    await dialog.getByLabel('Due on').fill(today);
    await dialog.getByLabel('Repeats').selectOption('12');
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(renewals.getByText(`${name} due today`)).toBeVisible();
    // Car publishes as it saves; the write needs a moment to reach the server before the page goes.
    await page.waitForTimeout(PUBLISH_MS);

    // Published to the household's to-do list a few seconds later; Renewed there, as another
    // member would from the portal.
    // Other repos' staging runs reseed the shared test users, which can end a session: sign in
    // afresh for each step that leaves the page.
    await signInTestUser(page, { email: 'test-a@example.com', path: '/todo' });
    await runPortalTodo(page, `Renew ${name}`, { timeout: 60_000 });

    // Back in Car the renewal moved a year on from its due date.
    await signInTestUser(page, { email: 'test-a@example.com' });
    await openTestCar(page);
    await renewals.getByRole('button', { name: `Edit ${name}` }).click();
    await expect(page.getByRole('dialog', { name: `Edit ${name}` }).getByLabel('Due on')).toHaveValue(addMonths(today, 12), { timeout: 20_000 });
    await page.getByRole('dialog', { name: `Edit ${name}` }).getByRole('button', { name: 'Cancel' }).click();
  } finally {
    await signInTestUser(page, { email: 'test-a@example.com' });
    await openTestCar(page);
    const edit = renewals.getByRole('button', { name: `Edit ${name}` });
    if (await edit.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await edit.click();
      await page.getByRole('dialog', { name: `Edit ${name}` }).getByRole('button', { name: 'Delete' }).click();
      await expect(edit).toHaveCount(0);
      // Its to-do (if the portal didn't already clear it) leaves with it.
      await page.waitForTimeout(PUBLISH_MS);
    }
    if (addedCar) {
      await page.getByRole('button', { name: `Edit ${CAR}` }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Delete car' }).click();
      await expect(page.getByRole('heading', { name: CAR })).toHaveCount(0);
    }
  }
});

test('an odometer reading one member logs shows for the other', async ({ page, browser }) => {
  await signInTestUser(page, { email: 'test-a@example.com' });
  await openTestCar(page);
  // Minutes since 2026: unique to the run and higher than any earlier run's reading.
  const reading = Math.floor((Date.now() - Date.UTC(2026, 0, 1)) / 60_000);
  const shown = reading.toLocaleString('en-US');
  await page.getByRole('region', { name: 'Odometer' }).getByRole('button', { name: 'Log odometer' }).click();
  const dialog = page.getByRole('dialog', { name: `Odometer: ${CAR}` });
  await dialog.getByLabel(/^Reading in /).fill(String(reading));
  await dialog.getByRole('button', { name: 'Save reading' }).click();
  await expect(page.getByText(`Logged ${shown} for ${CAR}`)).toBeVisible();
  await expect(page.getByRole('region', { name: 'Odometer' })).toContainText(shown);

  // Saved in the household, not just on this screen: the other member's own browser shows it.
  const other = await browser.newContext({ baseURL: test.info().project.use.baseURL });
  try {
    const theirs = await other.newPage();
    await signInTestUser(theirs, { email: 'test-b@example.com' });
    await openTestCar(theirs);
    await expect(theirs.getByRole('region', { name: 'Odometer' })).toContainText(shown, { timeout: 20_000 });
  } finally {
    await other.close();
  }
});

test.describe('as the household’s helper', () => {
  // Other apps' runs may reseed the household with an older kit that has no helper: put it back.
  test.beforeAll(async () => {
    await seedTestHousehold({ accessToken: process.env.HH_STAGING_ACCESS_TOKEN! });
  });

  test('can’t add or change a car and is told why, but logs an odometer reading', async ({ page, browser }) => {
    // The test car exists (added by an admin, as the household would).
    const admin = await browser.newContext({ baseURL: test.info().project.use.baseURL });
    try {
      const theirs = await admin.newPage();
      await signInTestUser(theirs, { email: 'test-a@example.com' });
      await openTestCar(theirs);
    } finally {
      await admin.close();
    }

    await signInTestUser(page, { email: 'test-helper@example.com' });
    await page.getByRole('button', { name: 'Cars', exact: true }).click({ timeout: 20_000 });
    // Refused: cars and the unit are the household's settings.
    await expect(page.getByText('Only admins and members can change settings.')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: 'Add car' })).toHaveCount(0);
    await page.getByRole('group', { name: 'Car' }).getByRole('button', { name: CAR, exact: true }).click();
    await expect(page.getByRole('button', { name: `Edit ${CAR}` })).toHaveCount(0);

    // Permitted: a reading of their own, which they may also delete.
    const reading = Math.floor((Date.now() - Date.UTC(2026, 0, 1)) / 60_000) + 1;
    const shown = reading.toLocaleString('en-US');
    await page.getByRole('region', { name: 'Odometer' }).getByRole('button', { name: 'Log odometer' }).click();
    const dialog = page.getByRole('dialog', { name: `Odometer: ${CAR}` });
    await dialog.getByLabel(/^Reading in /).fill(String(reading));
    await dialog.getByRole('button', { name: 'Save reading' }).click();
    await expect(page.getByText(`Logged ${shown} for ${CAR}`)).toBeVisible();
    await expect(page.getByRole('region', { name: 'Odometer' })).toContainText(shown);
    await expect(page.getByRole('button', { name: new RegExp(`^Delete reading ${shown} `) })).toBeVisible();
  });
});
