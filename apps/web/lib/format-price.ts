export function formatPriceCents(cents: number): string {
  if (!Number.isInteger(cents) || cents < 0) {
    throw new Error(`invalid price in cents: ${cents}`);
  }
  return (cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

// Parses a BRL amount typed by a user — "19,90", "19.90", or the
// thousands-separated "1.234,56" — into cents. A naive single comma->dot
// replace mishandles the last form (it leaves a second "." in the string and
// Number() silently returns NaN). Returns null for anything that isn't a
// valid positive amount so the caller can reject before acting on it.
export function parsePriceToCents(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const hasComma = trimmed.includes(',');
  const hasDot = trimmed.includes('.');
  const normalized = hasComma && hasDot
    ? trimmed.replace(/\./g, '').replace(',', '.')
    : hasComma
      ? trimmed.replace(',', '.')
      : trimmed;

  const value = Number(normalized);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value * 100);
}
