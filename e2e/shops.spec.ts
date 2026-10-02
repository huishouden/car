import { expect, test, type Page } from '@playwright/test';
import places from './fixtures/nominatim.json' with { type: 'json' };

// The sample household's shops (shared household contacts). Place search goes to OpenStreetMap's
// Nominatim, stubbed here with invented results.

const openShops = async (page: Page) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Shops', exact: true }).click();
};

test('a shop is one tap from a call or a map', async ({ page }) => {
  await openShops(page);
  const card = page.getByRole('region', { name: 'Example Auto Service' });
  await expect(card).toContainText('Mechanic');
  await expect(card.getByRole('link', { name: 'Call Example Auto Service, (555) 010-0164' })).toHaveAttribute('href', 'tel:5550100164');
  await expect(card.getByRole('link', { name: 'Open in Google Maps' })).toHaveAttribute('href', /^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=Example%20Auto%20Service/);
  await expect(card.getByRole('link', { name: 'autoservice.example.com' })).toHaveAttribute('href', 'https://autoservice.example.com');
});

test('Find a business fills the shop from OpenStreetMap, only on Search', async ({ page }) => {
  let searches = 0;
  await page.route('https://nominatim.openstreetmap.org/**', (route) => {
    searches++;
    return route.fulfill({ json: places });
  });
  await openShops(page);
  await page.getByRole('button', { name: 'Add shop' }).click();
  const dialog = page.getByRole('dialog', { name: 'New shop' });
  await dialog.getByLabel('Phone').fill('(555) 010-0199');
  await dialog.getByLabel('Find a business').fill('Example Car Wash Springfield');
  expect(searches).toBe(0);
  await expect(dialog.getByRole('link', { name: 'Search Google Maps' })).toHaveAttribute('href', 'https://www.google.com/maps/search/?api=1&query=Example%20Car%20Wash%20Springfield');
  await dialog.getByRole('button', { name: 'Search', exact: true }).click();

  const results = dialog.getByRole('list', { name: 'Places' }).getByRole('button');
  await expect(results).toHaveCount(2);
  expect(searches).toBe(1);
  await results.filter({ hasText: 'Example Car Wash' }).click();
  await expect(dialog.getByLabel('Name')).toHaveValue('Example Car Wash');
  await expect(dialog.getByLabel('Address')).toHaveValue('31 Demo Lane, Springfield, 00000, United States');
  await expect(dialog.getByLabel('Phone')).toHaveValue('(555) 010-0199');
  await dialog.getByRole('button', { name: 'Car wash' }).click();
  await dialog.getByRole('button', { name: 'Save' }).click();

  const card = page.getByRole('region', { name: 'Example Car Wash' });
  await expect(card).toContainText('Car wash');
  await expect(card.getByRole('link', { name: 'Open in Google Maps' })).toHaveAttribute('href', /query=Example%20Car%20Wash/);
});

test('deleting a shop can be undone', async ({ page }) => {
  await openShops(page);
  await page.getByRole('button', { name: 'Delete Sample Tire & Wheel' }).click();
  await expect(page.getByRole('region', { name: 'Sample Tire & Wheel' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByRole('region', { name: 'Sample Tire & Wheel' })).toBeVisible();
});

test('a shop on an appointment fills the place and shows its phone', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Appointments', exact: true }).click();
  await page.getByRole('button', { name: 'Add appointment' }).click();
  const dialog = page.getByRole('dialog', { name: 'New appointment' });
  await dialog.getByLabel('What').fill('Body work');
  await dialog.getByLabel('Car').selectOption({ label: 'Family van' });
  await dialog.getByLabel('Shop (optional)').selectOption({ label: 'Demo Motors Service' });
  await expect(dialog.getByLabel('Where (optional)')).toHaveValue('5 Sample Parkway, Springfield');
  await dialog.getByRole('button', { name: 'Save' }).click();
  const row = page.locator('main li', { hasText: 'Body work' });
  await expect(row).toContainText('Family van');
  await expect(row.getByRole('link', { name: 'Call Demo Motors Service, (555) 010-0191' })).toHaveAttribute('href', 'tel:5550100191');
});
