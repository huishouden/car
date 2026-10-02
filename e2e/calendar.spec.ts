import { expect, test } from '@playwright/test';
import { calendarEvents, mockCalendar } from './fixtures/calendar';

// Google Calendar has no emulator, and the sample app has no Google account: these tests stand in
// for the calendar with window.__mockCalendarEvents, which the kit's search answers from.

test('signed out, calendar search is off and says why', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Appointments', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Import from calendar' })).toBeDisabled();
  await expect(page.getByText('Sign in to search your calendar.')).toBeVisible();
  await page.getByRole('button', { name: 'Add appointment' }).click();
  const dialog = page.getByRole('dialog', { name: 'New appointment' });
  await dialog.getByLabel('What').fill('Oil change');
  await expect(dialog.getByRole('button', { name: 'Find in my calendar' })).toBeDisabled();
});

test.describe('with a calendar', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(mockCalendar, calendarEvents);
    await page.goto('/');
    await page.getByRole('button', { name: 'Appointments', exact: true }).click();
  });

  test('Find in my calendar fills the appointment, picks the car, and links the event', async ({ page }) => {
    await page.getByRole('button', { name: 'Add appointment' }).click();
    const dialog = page.getByRole('dialog', { name: 'New appointment' });
    await dialog.getByLabel('What').fill('Tire rotation');
    await expect(dialog.getByText('Google will ask once to let Car read your calendar. Car never changes it.')).toBeVisible();
    await dialog.getByRole('button', { name: 'Find in my calendar' }).click();
    const match = dialog.getByRole('list', { name: 'Calendar matches' }).getByRole('button', { name: /Tire rotation - Commuter/ });
    await match.click();
    await expect(dialog.getByLabel('Date')).toHaveValue('2031-05-06');
    await expect(dialog.getByLabel('Time')).toHaveValue('08:30');
    await expect(dialog.getByLabel('Car')).toHaveValue('demo-car-commuter');
    await expect(dialog.getByLabel('Where (optional)')).toHaveValue('Sample Tire & Wheel, 220 Demo Avenue, Springfield');
    await expect(dialog.getByLabel('Notes (optional)')).toHaveValue('Ask about the front tires.');
    await expect(dialog.getByRole('link', { name: 'Open in Calendar' })).toHaveAttribute('href', 'https://calendar.example.com/event?eid=evt-tires');
    await dialog.getByRole('button', { name: 'Save' }).click();
    const row = page.locator('main li', { hasText: 'Tire rotation' }).first();
    await expect(row.getByRole('link', { name: 'Open in Calendar' })).toHaveAttribute('href', 'https://calendar.example.com/event?eid=evt-tires');
  });

  test('Import from calendar lists new events once and adds them', async ({ page }) => {
    await page.getByRole('button', { name: 'Import from calendar' }).click();
    const dialog = page.getByRole('dialog', { name: 'Import from calendar' });
    const list = dialog.getByRole('list', { name: 'Calendar events' });
    await expect(list.getByRole('listitem')).toHaveCount(3);
    await list.getByRole('button', { name: 'Add Car wash' }).click();
    await expect(list.getByRole('listitem')).toHaveCount(2);
    await expect(page.getByText('Added Car wash')).toBeVisible();
    await dialog.getByRole('button', { name: 'Add all 2' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByText('Added 2 appointments')).toBeVisible();
    const upcoming = page.getByRole('region', { name: 'Upcoming appointments' });
    for (const title of ['Car wash', 'Registration renewal', 'Tire rotation - Commuter']) await expect(upcoming.getByText(title, { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Import from calendar' }).click();
    await expect(dialog.getByText('Every car event in your calendar is already in Car.')).toBeVisible();
  });

  test('a closed permission window is explained, with Try again', async ({ page }) => {
    await page.evaluate(() => {
      Object.defineProperty(window, '__mockCalendarEvents', {
        configurable: true,
        get() {
          throw Object.assign(new Error('Firebase: Error (auth/popup-closed-by-user).'), { code: 'auth/popup-closed-by-user' });
        },
      });
    });
    await page.getByRole('button', { name: 'Import from calendar' }).click();
    const alert = page.getByRole('dialog', { name: 'Import from calendar' }).getByRole('alert');
    await expect(alert).toContainText('Calendar access was not allowed');
    await expect(alert.getByRole('button', { name: 'Try again' })).toBeVisible();
  });
});
