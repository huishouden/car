import { expect, test } from '@playwright/test';
import { captureScreenshot } from '@huishouden/pwa-kit/e2e';
import places from './fixtures/nominatim.json' with { type: 'json' };
import { calendarEvents, mockCalendar } from './fixtures/calendar';

// README images of the signed-out app's invented sample household, refreshed by CI after each
// deploy. The clock is frozen at the sample data's moment so every run renders the same.
const fixedTime = '2031-04-15T09:30:00';

const tab = (name: string) => async (p: import('@playwright/test').Page) => {
  await p.getByRole('button', { name, exact: true }).click();
};

// On a phone, sections the bottom bar has no room for are under More (a build without the bar has none).
const phoneTab = (name: string) => async (p: import('@playwright/test').Page) => {
  const more = p.getByRole('navigation', { name: 'Sections' }).getByRole('button', { name: /^More/ });
  if (await more.isVisible()) {
    await more.click();
    await p.getByRole('dialog', { name: 'More' }).getByRole('button', { name, exact: true }).click();
  } else await tab(name)(p);
};

// Roles: the household's helper (sample data, `?role=helper`) keeps the log but changes no cars,
// settings or anyone else's records; admins and members can keep an appointment private.
test('helper: cars', ({ page }) =>
  captureScreenshot(page, 'helper-cars', {
    path: './?role=helper',
    fixedTime,
    prepare: async (p) => {
      await tab('Cars')(p);
      await expect(p.getByText('Only admins and members can change settings.')).toBeVisible();
    },
  }));

test('appointment: private', ({ page }) =>
  captureScreenshot(page, 'appointment-private', {
    fixedTime,
    prepare: async (p) => {
      await tab('Appointments')(p);
      await p.getByRole('button', { name: 'Add appointment' }).click();
      await p.getByLabel('What').fill('Body shop quote');
      await p.getByText('Only admins and members').click();
    },
  }));

test('overview', ({ page }) =>
  captureScreenshot(page, 'overview', {
    fixedTime,
    prepare: (p) => expect(p.getByText('Oil change due in 600 miles or 3 weeks')).toBeVisible(),
  }));

test('cars', ({ page }) =>
  captureScreenshot(page, 'cars', {
    fixedTime,
    prepare: async (p) => {
      await tab('Cars')(p);
      await expect(p.getByRole('region', { name: 'Service schedule' })).toBeVisible();
    },
  }));

test('renewals', ({ page }) =>
  captureScreenshot(page, 'renewals', {
    fixedTime,
    prepare: async (p) => {
      await tab('Renewals')(p);
      await expect(p.getByText('Registration expires in 12 days')).toBeVisible();
    },
  }));

test('history', ({ page }) =>
  captureScreenshot(page, 'history', {
    fixedTime,
    prepare: async (p) => {
      await tab('History')(p);
      await expect(p.getByText('Changed them ourselves.')).toBeVisible();
    },
  }));

test('log a service', ({ page }) =>
  captureScreenshot(page, 'log-service', {
    fixedTime,
    prepare: async (p) => {
      await p.getByRole('button', { name: 'Done: Oil change due in 600 miles or 3 weeks' }).click();
      await expect(p.getByRole('dialog', { name: 'Log a service' })).toBeVisible();
    },
  }));

test('appointments', ({ page }) =>
  captureScreenshot(page, 'appointments', {
    fixedTime,
    prepare: async (p) => {
      await tab('Appointments')(p);
      await expect(p.getByText('Ask them to check the front brakes.')).toBeVisible();
    },
  }));

test('calendar import', async ({ page }) => {
  await page.addInitScript(mockCalendar, calendarEvents);
  await captureScreenshot(page, 'calendar-import', {
    fixedTime,
    prepare: async (p) => {
      await tab('Appointments')(p);
      await p.getByRole('button', { name: 'Import from calendar' }).click();
      await expect(p.getByRole('list', { name: 'Calendar events' })).toBeVisible();
    },
  });
});

test('shops', ({ page }) =>
  captureScreenshot(page, 'shops', {
    fixedTime,
    prepare: async (p) => {
      await tab('Shops')(p);
      await expect(p.getByText('Example Auto Service')).toBeVisible();
    },
  }));

test('shop search', async ({ page }) => {
  await page.route('https://nominatim.openstreetmap.org/**', (route) => route.fulfill({ json: places }));
  await captureScreenshot(page, 'shop-search', {
    fixedTime,
    prepare: async (p) => {
      await tab('Shops')(p);
      await p.getByRole('button', { name: 'Add shop' }).click();
      const dialog = p.getByRole('dialog', { name: 'New shop' });
      await dialog.getByLabel('Find a business').fill('Example Springfield');
      await dialog.getByRole('button', { name: 'Search', exact: true }).click();
      await expect(dialog.getByRole('list', { name: 'Places' })).toBeVisible();
    },
  });
});

test('phone: overview', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await captureScreenshot(page, 'phone-overview', {
    fixedTime,
    prepare: (p) => expect(p.getByText('Oil change due in 600 miles or 3 weeks')).toBeVisible(),
  });
});

test('phone: cars', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await captureScreenshot(page, 'phone-cars', {
    fixedTime,
    prepare: async (p) => {
      await phoneTab('Cars')(p);
      await expect(p.getByRole('region', { name: 'Service schedule' })).toBeVisible();
    },
  });
});

// The kit's app bar with an invented signed-in person and the account menu open.
test('account menu', ({ page }) =>
  captureScreenshot(page, 'account-menu', {
    fixedTime,
    prepare: async (p) => {
      await p.locator('hh-app-bar').evaluate((bar: HTMLElementTagNameMap['hh-app-bar']) => {
        bar.user = { name: 'Sam Example', email: 'sam@example.com', photoURL: null };
      });
      await p.getByRole('button', { name: 'Signed in as sam@example.com' }).click();
      await expect(p.getByRole('link', { name: 'All apps' })).toBeVisible();
    },
  }));

// Paused service items and closed renewals stay on the car's page, marked, with Resume / Reopen.
test('cars: paused and closed', ({ page }) =>
  captureScreenshot(page, 'cars-set-aside', {
    fixedTime,
    prepare: async (p) => {
      await phoneTab('Cars')(p);
      await p.getByRole('group', { name: 'Car' }).getByRole('button', { name: 'Commuter', exact: true }).click();
      await expect(p.getByRole('button', { name: 'Resume Underbody wash' })).toBeVisible();
    },
  }));
