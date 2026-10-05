import { describe, expect, it } from 'vitest';
import { parseAmount } from './money';

describe('parseAmount', () => {
  it.each([
    ['1500000', 150000000],
    ['1.500.000', 150000000],
    ['1,500,000', 150000000],
    ['1.500.000,50', 150000050],
    ['1500.5', 150050],
    ['$ 2.000', 200000],
  ])('%s -> %i', (input, expected) => {
    expect(parseAmount(input)).toBe(expected);
  });

  it('devuelve null si no hay número', () => {
    expect(parseAmount('abc')).toBeNull();
    expect(parseAmount('')).toBeNull();
  });
});
