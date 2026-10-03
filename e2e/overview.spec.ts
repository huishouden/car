import { expect, test } from '@playwright/test';

// The sample household (signed out, nothing saved): what is due across both cars.

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime('2031-04-15T09:30:00');
  await page.goto('./');
});

test('what is due reads at a glance, overdue first', async ({ page }) => {
  const list = page.getByRole('region', { name: 'Coming up' }).getByRole('listitem');
  await expect(list.first()).toContainText('Inspection overdue by 2 weeks');
  await expect(list.first()).toContainText('Overdue');
  await expect(list.nth(1)).toContainText('Registration expires in 12 days');
  await expect(page.getByText('4 things need doing soon')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Family van' })).toContainText('41,400');
  await expect(page.getByRole('region', { name: 'Next appointment' })).toContainText('Oil change');
});

test('Done logs the service, moves the schedule on, and can be undone', async ({ page }) => {
  await page.getByRole('button', { name: 'Done: Oil change due in 600 miles or 3 weeks' }).click();
  const dialog = page.getByRole('dialog', { name: 'Log a service' });
  await expect(dialog.getByLabel('What was done')).toHaveValue('Oil change');
  await expect(dialog.getByRole('checkbox', { name: 'Oil change' })).toBeChecked();
  await dialog.getByRole('checkbox', { name: 'Cabin air filter' }).check();
  await expect(dialog.getByLabel('What was done')).toHaveValue('Cabin air filter and oil change');
  await dialog.getByLabel('Odometer (miles)').fill('41,450');
  await dialog.getByLabel('Shop (optional)').selectOption({ label: 'Example Auto Service' });
  await dialog.getByLabel('Cost (optional)').fill('89.99');
  await dialog.getByRole('button', { name: 'Save' }).click();

  await expect(page.getByText(/^Logged Cabin air filter and oil change/)).toBeVisible();
  const coming = page.getByRole('region', { name: 'Coming up' });
  await expect(coming.getByText('Oil change due in 5,000 miles or 6 months')).toBeVisible();
  await expect(page.getByText('3 things need doing soon')).toBeVisible();

  await page.getByRole('button', { name: 'History', exact: true }).click();
  await expect(page.getByText('$168.48 spent in 2031 on 3 visits')).toBeVisible();

  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByText('$78.49 spent in 2031 on 2 visits')).toBeVisible();
  await page.getByRole('button', { name: 'Overview', exact: true }).click();
  await expect(page.getByText('Oil change due in 600 miles or 3 weeks')).toBeVisible();
});

test('Renewed moves registration on a year, with Undo', async ({ page }) => {
  await page.getByRole('button', { name: 'Renewed: Registration expires in 12 days' }).click();
  await expect(page.getByText(/Registration next due Apr 27, 2032/)).toBeVisible();
  await expect(page.getByText('Registration expires in 12 days')).toHaveCount(0);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByText('Registration expires in 12 days')).toBeVisible();
});

test('a new odometer reading changes what is due by mileage', async ({ page }) => {
  await page.getByRole('button', { name: /^Log odometer for Family van/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Odometer: Family van' });
  await expect(dialog.getByText('Last: 41,400 miles')).toBeVisible();
  await dialog.getByLabel('Reading in miles').fill('42300');
  await dialog.getByRole('button', { name: 'Save reading' }).click();
  await expect(page.getByText('Oil change overdue by 300 miles')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Family van' })).toContainText('42,300');
});

test('a renewal for every car', async ({ page }) => {
  await page.getByRole('button', { name: 'Renewals', exact: true }).click();
  await page.getByRole('button', { name: 'Add renewal' }).click();
  const dialog = page.getByRole('dialog', { name: 'New renewal' });
  await dialog.getByRole('button', { name: 'Other' }).click();
  await dialog.getByLabel('Name').fill('Parking permit');
  await dialog.getByLabel('Car').selectOption({ label: 'All cars' });
  await dialog.getByLabel('Due on').fill('2031-04-20');
  await dialog.getByRole('button', { name: 'Save' }).click();
  const row = page.getByRole('region', { name: 'All renewals' }).getByRole('listitem').filter({ hasText: 'Parking permit' });
  await expect(row).toContainText('Parking permit due in 5 days');
  await expect(row).toContainText('All cars');
});
