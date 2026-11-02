export const ID_PATTERN = /^[A-Z][A-Z0-9_-]{0,15}$/;

// Plain code-unit order. localeCompare would sort '-' and '_' differently from the ASCII order the brief requires.
export function compareIds(a, b) {
  if (a < b) return -1;
  return a > b ? 1 : 0;
}
