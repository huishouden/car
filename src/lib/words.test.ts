import { expect, test } from 'bun:test';
import { joinNames } from './words';

test.each([
  [[], ''],
  [['Oil change'], 'Oil change'],
  [['Oil change', 'Tire rotation'], 'Oil change and tire rotation'],
  [['Oil change', 'Tire rotation', 'Wiper blades'], 'Oil change, tire rotation, and wiper blades'],
])('%p', (names, text) => expect(joinNames(names)).toBe(text));
