import { describe, expect, test } from 'bun:test';
import type { Contact } from '@huishouden/pwa-kit/contacts';
import { contactInput, displayWebsite, groupContacts } from './contacts';

const c = (name: string, role?: string): Contact => ({ id: name, name, role, apps: ['car'], createdAt: 1, by: 'sam@example.com' });

test('shops group by known role first, then typed roles, then Other', () => {
  const groups = groupContacts([c('Zed Detailing', 'detailing'), c('B Tires', 'tires'), c('A Garage', 'Mechanic'), c('No Role'), c('Dealer One', 'Dealer')]);
  expect(groups.map((g) => [g.role, g.contacts.map((x) => x.name)])).toEqual([
    ['Mechanic', ['A Garage']],
    ['Dealer', ['Dealer One']],
    ['Tires', ['B Tires']],
    ['detailing', ['Zed Detailing']],
    ['Other', ['No Role']],
  ]);
});

describe('saving a shop', () => {
  test('trims, makes the website a link, and adds Car to the apps', () => {
    expect(contactInput({ name: ' Example Auto Service ', role: 'Mechanic', website: 'autoservice.example.com', phone: ' ' }, [])).toEqual({
      name: 'Example Auto Service',
      role: 'Mechanic',
      phone: undefined,
      email: undefined,
      website: 'https://autoservice.example.com',
      address: undefined,
      mapsUrl: undefined,
      notes: undefined,
      apps: ['car'],
    });
  });

  test('keeps the other apps that show it', () => {
    expect(contactInput({ name: 'Example Insurance' }, ['home']).apps).toEqual(['home', 'car']);
    expect(contactInput({ name: 'Example Insurance' }, ['car', 'home']).apps).toEqual(['car', 'home']);
  });

  test('websites read compactly', () => {
    expect(displayWebsite('https://www.autoservice.example.com/')).toBe('autoservice.example.com');
  });
});
