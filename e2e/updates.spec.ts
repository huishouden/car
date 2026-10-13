import { expect, test, type Page } from '@playwright/test';

// The screen lives in the address (kit STANDARD.md "Updates"): a reload, which a new version may
// need, and Back and Forward return to the same tab and car. The signed-out sample household.

const currentTab = (page: Page) => page.locator('nav[slot="nav"] button[aria-current="page"]');
const carChip = (page: Page, name: string) => page.getByRole('group', { name: 'Car' }).getByRole('button', { name, exact: true });

test('a reload and Back return to the screen in the address', async ({ page }) => {
  await page.goto('./');
  await expect(currentTab(page)).toHaveText('Overview');
  await page.getByRole('button', { name: 'Renewals', exact: true }).first().click();
  await expect(page).toHaveURL(/\?tab=renewals$/);
  await page.getByRole('button', { name: 'Cars', exact: true }).first().click();
  await carChip(page, 'Commuter').click();
  await expect(page).toHaveURL(/\?tab=cars&car=/);
  await page.reload();
  await expect(currentTab(page)).toHaveText('Cars');
  await expect(carChip(page, 'Commuter')).toHaveAttribute('aria-pressed', 'true');
  await page.goBack();
  await expect(currentTab(page)).toHaveText('Renewals');
  await page.goForward();
  await expect(currentTab(page)).toHaveText('Cars');
  await expect(carChip(page, 'Commuter')).toHaveAttribute('aria-pressed', 'true');
});
