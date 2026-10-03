import { expect, test, type Page } from '@playwright/test';
import peopleSearch from './fixtures/contacts/people-search.json' with { type: 'json' };
import otherContacts from './fixtures/contacts/other-contacts.json' with { type: 'json' };

// Adding a shop from the person's own contacts, on the sample household (signed out, nothing saved):
// a contact card file, the phone's contact picker and Google Contacts (People API stubbed with
// invented people).

const fixture = (name: string) => new URL(`./fixtures/contacts/${name}`, import.meta.url).pathname;

const newShop = async (page: Page) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Shops', exact: true }).click();
  await page.getByRole('button', { name: 'Add shop' }).click();
  return page.getByRole('dialog', { name: 'New shop' });
};

test('a contact card fills the new shop', async ({ page }) => {
  const dialog = await newShop(page);
  const chooser = page.waitForEvent('filechooser');
  await dialog.getByRole('button', { name: 'Import a contact card' }).click();
  await (await chooser).setFiles(fixture('mechanic.vcf'));

  await expect(dialog.getByText('Filled in the name, role, phone, email, address and notes from the contact card.')).toBeVisible();
  await expect(dialog.getByLabel('Name', { exact: true })).toHaveValue('Morgan Example');
  await expect(dialog.getByLabel('Phone', { exact: true })).toHaveValue('(555) 010-0132');
  await expect(dialog.getByLabel('Email', { exact: true })).toHaveValue('morgan@brakes.example.com');
  await expect(dialog.getByLabel('Address', { exact: true })).toHaveValue('80 Example Road, Bay 2, Springfield, IL 62704, United States');
  await expect(dialog.getByLabel('Notes')).toHaveValue('Other phones: (555) 010-0133 (work)\nAsk for Morgan.');
  await dialog.getByRole('button', { name: 'Mechanic' }).click();
  await dialog.getByRole('button', { name: 'Save' }).click();

  const card = page.getByRole('region', { name: 'Morgan Example' });
  await expect(card).toContainText('Mechanic');
  await expect(card.getByRole('link', { name: 'Call Morgan Example, (555) 010-0132' })).toHaveAttribute('href', 'tel:5550100132');
});

test('a file with two people asks which one', async ({ page }) => {
  const dialog = await newShop(page);
  const chooser = page.waitForEvent('filechooser');
  await dialog.getByRole('button', { name: 'Import a contact card' }).click();
  await (await chooser).setFiles(fixture('two.vcf'));
  const people = dialog.getByRole('list', { name: 'Contacts to choose from' }).getByRole('button');
  await expect(people).toHaveCount(2);
  await people.filter({ hasText: 'Example Car Wash' }).click();
  await expect(dialog.getByLabel('Name', { exact: true })).toHaveValue('Example Car Wash');
  await expect(dialog.getByLabel('Phone', { exact: true })).toHaveValue('555-010-0135');
});

test('"Pick from my contacts" only where the browser has a contact picker', async ({ page }) => {
  const dialog = await newShop(page);
  await expect(dialog.getByRole('button', { name: 'Import a contact card' })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Pick from my contacts' })).toHaveCount(0);
});

test('the phone’s contact picker fills the new shop', async ({ page }) => {
  // Chrome on Android's Contact Picker, stood in for: one contact chosen.
  await page.addInitScript(() => {
    Object.assign(window, { ContactsManager: function ContactsManager() {} });
    Object.defineProperty(navigator, 'contacts', {
      value: {
        getProperties: async () => ['name', 'tel', 'email', 'address'],
        select: async () => [{ name: ['Sam Sample'], tel: ['555-010-0134'], email: ['sam@example.com'], address: [] }],
      },
    });
  });
  const dialog = await newShop(page);
  await dialog.getByRole('button', { name: 'Pick from my contacts' }).click();
  await expect(dialog.getByLabel('Name', { exact: true })).toHaveValue('Sam Sample');
  await expect(dialog.getByLabel('Phone', { exact: true })).toHaveValue('555-010-0134');
  await expect(dialog.getByText('from your contacts')).toBeVisible();
});

test('Find in my Google Contacts searches saved and other contacts', async ({ page }) => {
  await page.addInitScript(() => Object.assign(window, { __mockGoogleContactsToken: 'contacts-token' }));
  const asked: string[] = [];
  await page.route('https://people.googleapis.com/**', (route) => {
    const url = new URL(route.request().url());
    const q = url.searchParams.get('query') ?? '';
    asked.push(`${url.pathname} ${q}`);
    expect(route.request().headers().authorization).toBe('Bearer contacts-token');
    if (!q) return route.fulfill({ json: {} });
    return route.fulfill({ json: url.pathname.endsWith('people:searchContacts') ? peopleSearch : otherContacts });
  });
  const dialog = await newShop(page);
  await dialog.getByRole('button', { name: 'Find in my Google Contacts' }).click();
  await expect(dialog.getByText('If Google says it hasn’t verified this app')).toBeVisible();
  await dialog.getByLabel('Name, email or phone').fill('morgan');
  await dialog.getByRole('button', { name: 'Search', exact: true }).first().click();

  const people = dialog.getByRole('list', { name: 'Contacts to choose from' }).getByRole('button');
  await expect(people).toHaveCount(2);
  await people.filter({ hasText: 'Morgan Example' }).click();
  await expect(dialog.getByLabel('Name', { exact: true })).toHaveValue('Morgan Example');
  await expect(dialog.getByLabel('Address', { exact: true })).toHaveValue('80 Example Road, Springfield, IL 62704');
  // Google asks for an empty search first to warm its cache.
  expect(asked).toEqual(['/v1/people:searchContacts ', '/v1/otherContacts:search ', '/v1/people:searchContacts morgan', '/v1/otherContacts:search morgan']);
});
