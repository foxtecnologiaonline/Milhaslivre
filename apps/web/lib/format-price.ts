export function formatPriceCents(cents: number): string {
  if (!Number.isInteger(cents) || cents < 0) {
    throw new Error(`invalid price in cents: ${cents}`);
  }
  return (cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}
