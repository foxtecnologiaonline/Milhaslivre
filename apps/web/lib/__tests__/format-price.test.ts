import { describe, expect, it } from 'vitest';
import { formatPriceCents, parsePriceToCents } from '../format-price';

describe('formatPriceCents', () => {
  it('formats cents as BRL on the happy path', () => {
    // Node's ICU data may separate "R$" from the amount with a regular
    // space or a non-breaking space (U+00A0) depending on version —
    // normalize before comparing so the test doesn't depend on that.
    expect(formatPriceCents(12345).replace(/\s/, ' ')).toBe('R$ 123,45');
  });

  it('rejects a negative amount', () => {
    expect(() => formatPriceCents(-1)).toThrow('invalid price in cents');
  });
});

describe('parsePriceToCents', () => {
  it('parses a plain comma-decimal amount on the happy path', () => {
    expect(parsePriceToCents('19,90')).toBe(1990);
  });

  it('parses a dot-decimal amount', () => {
    expect(parsePriceToCents('19.90')).toBe(1990);
  });

  it('parses a BR thousands-separated amount', () => {
    expect(parsePriceToCents('1.234,56')).toBe(123456);
  });

  it('returns null for an empty or non-numeric input', () => {
    expect(parsePriceToCents('')).toBeNull();
    expect(parsePriceToCents('abc')).toBeNull();
  });

  it('returns null for zero or negative amounts', () => {
    expect(parsePriceToCents('0')).toBeNull();
    expect(parsePriceToCents('-5,00')).toBeNull();
  });
});
