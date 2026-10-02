import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime('2031-04-15T09:30:00');
  await page.goto('/');
  await page.getByRole('button', { name: 'Cars', exact: true }).click();
});

test('a new car starts with the usual schedule', async ({ page }) => {
  await page.getByRole('button', { name: 'Add car' }).click();
  const dialog = page.getByRole('dialog', { name: 'New car' });
  await dialog.getByLabel('Nickname').fill('Weekend car');
  await dialog.getByLabel('Make').fill('Example');
  await dialog.getByLabel('Year').fill('2029');
  await expect(dialog.getByRole('checkbox', { name: 'Start with the usual schedule' })).toBeChecked();
  await dialog.getByRole('button', { name: 'Save' }).click();

  await expect(page.getByRole('heading', { name: 'Weekend car' })).toBeVisible();
  const schedule = page.getByRole('region', { name: 'Service schedule' });
  for (const name of ['Oil change', 'Tire rotation', 'Inspection', 'Wiper blades']) await expect(schedule.getByText(`${name}: no record yet`)).toBeVisible();
  await expect(schedule.getByText('Every 6 months or 5,000 miles')).toBeVisible();
});

test('a schedule item due by time or distance', async ({ page }) => {
  await page.getByRole('region', { name: 'Service schedule' }).getByRole('button', { name: 'Add item' }).click();
  const dialog = page.getByRole('dialog', { name: 'New service item' });
  await dialog.getByRole('button', { name: 'Brake check' }).click();
  await dialog.getByLabel('Every how many months').fill('12');
  await dialog.getByLabel('Every how many miles').fill('12,000');
  await dialog.getByLabel('Last done on').fill('2030-06-01');
  await dialog.getByLabel('Last done at').fill('30000');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Brake check due in 600 miles or 6 weeks')).toBeVisible();
});

test('kilometres relabel every distance', async ({ page }) => {
  await page.getByRole('group', { name: 'Distance unit' }).getByRole('button', { name: 'Kilometres' }).click();
  await expect(page.getByRole('region', { name: 'Odometer' })).toContainText('kilometres');
  await expect(page.getByText('Every 6 months or 5,000 kilometres')).toBeVisible();
});

test('deleting a car takes its history with it, and Undo brings it all back', async ({ page }) => {
  await page.getByRole('button', { name: 'Commuter', exact: true }).click();
  await page.getByRole('button', { name: 'Edit Commuter' }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit Commuter' });
  await dialog.getByRole('button', { name: 'Delete' }).click();
  await expect(dialog.getByText('Delete Commuter with its schedule, readings, renewals and history?')).toBeVisible();
  await dialog.getByRole('button', { name: 'Delete car' }).click();
  await expect(page.getByRole('button', { name: 'Commuter', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Undo' }).click();
  await page.getByRole('button', { name: 'History', exact: true }).click();
  await expect(page.getByText('Oil change and tire rotation')).toBeVisible();
});

test('a wrong reading can be deleted and restored', async ({ page }) => {
  const readings = page.getByRole('list', { name: 'Readings' });
  await readings.getByRole('button', { name: /^Delete reading 41,400/ }).click();
  await expect(page.getByRole('region', { name: 'Odometer' })).toContainText('40,050');
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByRole('region', { name: 'Odometer' })).toContainText('41,400');
});
