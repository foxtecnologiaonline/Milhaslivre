import { describe, expect, it } from 'vitest';
import { formatPriceCents } from '../format-price';

describe('formatPriceCents', () => {
  it('formats cents as BRL on the happy path', () => {
    expect(formatPriceCents(12345)).toBe('R$ 123,45');
  });

  it('rejects a negative amount', () => {
    expect(() => formatPriceCents(-1)).toThrow('invalid price in cents');
  });
});
