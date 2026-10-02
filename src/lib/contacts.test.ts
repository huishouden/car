import { describe, expect, test } from 'bun:test';
import { contactInput, groupContacts, type Contact } from '@huishouden/pwa-kit/contacts';
import { APP, ROLES } from './contacts';

const c = (name: string, role?: string): Contact => ({ id: name, name, role, apps: ['car'], createdAt: 1, by: 'sam@example.com' });

test('shops group by known role first, then typed roles, then Other', () => {
  const groups = groupContacts([c('Zed Detailing', 'detailing'), c('B Tires', 'tires'), c('A Garage', 'Mechanic'), c('No Role'), c('Dealer One', 'Dealer')], ROLES);
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
    expect(contactInput({ name: ' Example Auto Service ', role: 'Mechanic', website: 'autoservice.example.com', phone: ' ' }, [], APP)).toEqual({
      name: 'Example Auto Service',
      role: 'Mechanic',
      phone: undefined,
      email: undefined,
      website: 'https://autoservice.example.com',
      address: undefined,
      mapsUrl: undefined,
      notes: undefined,
      apps: ['car'],
      private: false,
    });
  });

  test('keeps the other apps that show it', () => {
    expect(contactInput({ name: 'Example Insurance' }, ['home'], APP).apps).toEqual(['home', 'car']);
    expect(contactInput({ name: 'Example Insurance' }, ['car', 'home'], APP).apps).toEqual(['car', 'home']);
  });

});
