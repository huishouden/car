// Costs as whole cents, so sums never drift. USD, the household's currency.

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const usdWhole = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

/** "$89.99"; `headline` rounds to whole dollars for the one big number ("$1,235"). */
export function formatCents(cents: number, options: { headline?: boolean } = {}): string {
  return (options.headline ? usdWhole : usd).format(cents / 100);
}

/** "89.99", "$1,234.5", "40" → cents; blank → undefined; anything else → null. */
export function parseMoney(text: string): number | undefined | null {
  const t = text.trim().replace(/^\$/, '').replace(/,/g, '').trim();
  if (!t) return undefined;
  if (!/^\d{1,7}(\.\d{0,2})?$/.test(t)) return null;
  const [whole, frac = ''] = t.split('.');
  return Number(whole) * 100 + Number(frac.padEnd(2, '0'));
}

/** Cents as the dialog shows them for editing: 8999 → "89.99". */
export const centsInput = (cents: number | undefined) => (cents === undefined ? '' : (cents / 100).toFixed(2));
