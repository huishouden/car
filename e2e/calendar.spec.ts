import { expect, test } from '@playwright/test';
import { stubCalendar } from '@huishouden/pwa-kit/e2e';
import { calendarEvents, mockCalendar } from './fixtures/calendar';

// Google Calendar has no emulator, and the sample app has no Google account: these tests stand in
// for the calendar with window.__mockCalendarEvents, which the kit's search answers from.

test('signed out, calendar search is off and says why', async ({ page }) => {
  await page.goto('./');
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
    await page.goto('./');
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

// Something an assistant put in the calendar shows up on the main screen on its own, but only on a
// device that already has a calendar token (stubbed here): the app never asks on open.
test.describe('new in your calendar', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime('2031-04-15T09:30:00');
    await stubCalendar(page, { events: calendarEvents });
    await page.goto('./');
  });

  test('offers new events on the main screen; Add picks the car, Not this one hides it', async ({ page }) => {
    const card = page.getByRole('region', { name: 'New in your calendar' });
    await expect(card).toContainText('New in your calendar: Registration renewal');
    await expect(card).not.toContainText('Oil change');
    await card.getByRole('button', { name: '+2 more' }).click();
    await expect(card.getByRole('list', { name: 'More new calendar events' }).getByRole('listitem')).toHaveCount(2);

    await card.getByRole('button', { name: 'Add Tire rotation - Commuter' }).click();
    await expect(page.getByText('Added Tire rotation - Commuter')).toBeVisible();
    await expect(card.getByRole('button', { name: '+1 more' })).toBeVisible();

    await card.getByRole('button', { name: 'Not this one: Registration renewal' }).click();
    await expect(card).toContainText('New in your calendar: Car wash');
    await expect(card.getByRole('button', { name: /more/ })).toHaveCount(0);

    await page.getByRole('button', { name: 'Appointments', exact: true }).click();
    await expect(card).toHaveCount(0);
    await page.getByRole('region', { name: 'Upcoming appointments' }).getByRole('button', { name: 'Edit Tire rotation - Commuter' }).click();
    await expect(page.getByRole('dialog').getByLabel('Car')).toHaveValue('demo-car-commuter');
  });

  test('a dismissed event stays dismissed after reopening', async ({ page }) => {
    const card = page.getByRole('region', { name: 'New in your calendar' });
    await card.getByRole('button', { name: 'Not this one: Registration renewal' }).click();
    await page.reload();
    await expect(card).toContainText('New in your calendar: Tire rotation - Commuter');
    await expect(card).not.toContainText('Registration renewal');
  });
});

test('no calendar token on the device: no card and no Google window', async ({ page }) => {
  await page.clock.setFixedTime('2031-04-15T09:30:00');
  await stubCalendar(page, { events: calendarEvents, cachedToken: false });
  await page.goto('./');
  await expect(page.getByRole('heading').first()).toBeVisible();
  await expect(page.getByRole('region', { name: 'New in your calendar' })).toHaveCount(0);
  expect(page.context().pages()).toHaveLength(1);
});
