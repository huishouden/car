import { formatList } from '@huishouden/pwa-kit/i18n';

/** "Oil change", "Oil change and tire rotation", "Oil change, tire rotation, and wiper blades" (in the page's language). */
export function joinNames(names: string[]): string {
  const [first, ...rest] = names;
  if (!first) return '';
  return formatList([first, ...rest.map((n) => n.charAt(0).toLowerCase() + n.slice(1))]);
}
