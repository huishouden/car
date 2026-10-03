import { expect, test } from '@playwright/test';
import { expectBottomNav, expectCleanLoad, expectCompactSampleBanner, expectGoogleSignInPopup, expectHuishoudenFrame, expectInstallable, expectSecurityHeaders, expectThemeConsistent } from '@huishouden/pwa-kit/e2e';

test('loads without runtime errors and shows the sample cars', async ({ page }) => {
  await expectCleanLoad(page);
  await expect(page.getByText('Sample data')).toBeVisible();
  await expect(page.getByText('Oil change due in 600 miles or 3 weeks')).toBeVisible();
  await expectHuishoudenFrame(page, { app: 'Car', portalUrl: '/' });
});

test('is installable', ({ page, request }) => expectInstallable(page, request));

test('Google sign-in popup reaches Google with an allowed redirect URI', ({ page, context }) =>
  expectGoogleSignInPopup(page, context, async (p) => {
    await p.getByRole('button', { name: 'Sign in with Google' }).first().click();
  }));

test('sends the security headers and leaves sign-in un-framed', ({ request }) => expectSecurityHeaders(request, './', { camera: true }));

test('Sample data banner is one line on a phone', ({ page }) => expectCompactSampleBanner(page, './'));

test('on a phone the sections are a bottom bar, with Cars and Shops under More', ({ page }) => expectBottomNav(page, { path: './', labels: ['Overview', 'Renewals', 'History', 'Bookings', 'More'], more: ['Cars', 'Shops'] }));

test('follows the suite theme: dark on a dark device, readable', ({ page }) => expectThemeConsistent(page, { path: './' }));
