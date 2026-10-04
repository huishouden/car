import { expect, test } from '@playwright/test';
import { expectLocalized, useLanguage } from '@huishouden/pwa-kit/e2e';
import es from '../src/locales/es.json' with { type: 'json' };
import nl from '../src/locales/nl.json' with { type: 'json' };

// The signed-out sample in Spanish and Dutch: Car's own chrome and the kit's, no English left. Car
// names, shops and notes are sample data and stay as written.
const fixedTime = '2031-04-15T09:30:00';
const ENGLISH = ['Coming up', 'Log a service', 'Log odometer', 'Next appointment', 'Renewals', 'History', 'Shops', 'Overview', 'Registration', 'Oil change', 'Tire rotation', 'due in', 'expires', 'renews'];

for (const [lang, messages] of [
  ['es', es],
  ['nl', nl],
] as const) {
  test(`the sample in ${lang}`, async ({ page }) => {
    await page.clock.setFixedTime(fixedTime);
    await expectLocalized(page, lang, { words: ENGLISH });
    await expect(page.getByRole('heading', { name: messages['overview.comingUp'] })).toBeVisible();
    await expect(page.getByRole('region', { name: messages['overview.comingUp'] })).toContainText(messages['item.oil']);

    await page.getByRole('button', { name: messages['visit.log'] }).first().click();
    const dialog = page.getByRole('dialog', { name: messages['visit.log'] });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(messages['visit.what'], { exact: true })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Save', exact: true })).toHaveCount(0);
    await expect(dialog.getByRole('button', { name: 'Cancel', exact: true })).toHaveCount(0);
  });
}

test('a Dutch phone in the Netherlands reads the sample in kilometres', async ({ browser }) => {
  const context = await browser.newContext({ locale: 'nl-NL' });
  const page = await context.newPage();
  await page.clock.setFixedTime(fixedTime);
  await useLanguage(page, 'nl');
  await page.goto('./', { waitUntil: 'networkidle' });
  const car = page.getByRole('region', { name: 'Family van' });
  await expect(car).toContainText('kilometer');
  await expect(car).toContainText('66.630');
  await expect(page.getByRole('region', { name: nl['overview.comingUp'] })).not.toContainText('mijl');
  await context.close();
});

test('a cost typed with a decimal comma is kept the Dutch way', async ({ page }) => {
  await page.clock.setFixedTime(fixedTime);
  await useLanguage(page, 'nl');
  await page.goto('./', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: nl['visit.log'] }).first().click();
  const dialog = page.getByRole('dialog', { name: nl['visit.log'] });
  await dialog.getByLabel(nl['visit.what']).fill('Example wash');
  await dialog.getByLabel(nl['visit.cost']).fill('12,50');
  await dialog.getByRole('button', { name: 'Opslaan', exact: true }).click();
  await expect(dialog).toBeHidden();
  await page.getByRole('button', { name: nl['tab.history'], exact: true }).first().click();
  const row = page.getByRole('listitem').filter({ hasText: 'Example wash' });
  await expect(row).toContainText('12,50');
  await expect(row).not.toContainText('1.250');
});
