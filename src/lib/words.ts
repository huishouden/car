/** "Oil change", "Oil change and tire rotation", "Oil change, tire rotation and wiper blades". */
export function joinNames(names: string[]): string {
  const [first, ...rest] = names;
  if (!first) return '';
  const lower = rest.map((n) => n.charAt(0).toLowerCase() + n.slice(1));
  if (lower.length === 0) return first;
  return `${[first, ...lower.slice(0, -1)].join(', ')} and ${lower[lower.length - 1]}`;
}
