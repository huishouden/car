import { expect, test, type Page } from '@playwright/test';
import { signInTestUser } from '@huishouden/pwa-kit/e2e';

// Signed in as an invented test user on the staging site (pwa-kit STANDARD.md "Staging"): the real
// staging Firestore and rules, the seeded test household. Other runs share that household, so each
// test writes a value unique to its run and looks for exactly that.
test.skip(!process.env.HH_STAGING_SA, 'signed-in tests run against staging, in CI');

const CAR = 'Test car';

/** The Cars screen on the test car, which is added the first time the household runs this. */
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
