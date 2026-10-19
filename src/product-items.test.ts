import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildEvent, type DataLayerEvent } from './analytics';

const code = readFileSync(new URL('../adobe-tags/product-items.js', import.meta.url), 'utf8');
const readProducts = new Function('event', code) as (
  event: { message: DataLayerEvent },
) => { SKU: string; name: string; quantity: number; priceTotal: number; currencyCode: string }[];
const user = { firstName: 'Alex', email: 'alex@example.com' };

beforeEach(() => vi.stubGlobal('window', { location: { href: 'http://localhost:5173/' } }));
afterEach(() => vi.unstubAllGlobals());

describe('small product-array data element', () => {
  it.each(['add-to-cart', 'remove-from-cart'] as const)('reads the current %s message without modifying it', (event) => {
    const message = buildEvent(event, user, { items: [{ productId: 'FST-001', quantity: 2 }] });
    const original = structuredClone(message);
    expect(readProducts({ message })).toEqual([
      { SKU: 'FST-001', name: 'The Green Goddess', quantity: 2, priceTotal: 698, currencyCode: 'INR' },
    ]);
    expect(message).toEqual(original);
  });

  it('includes every order line, not just the first product', () => {
    const message = buildEvent('purchase', user, {
      order: {
        id: 'FST-123456ABCDEF', createdAt: new Date().toISOString(), total: 1197,
        items: [{ productId: 'FST-001', quantity: 1 }, { productId: 'FST-002', quantity: 1 }, { productId: 'FST-003', quantity: 1 }],
      },
    });
    expect(readProducts({ message })).toEqual([
      { SKU: 'FST-001', name: 'The Green Goddess', quantity: 1, priceTotal: 349, currencyCode: 'INR' },
      { SKU: 'FST-002', name: 'The Comfort Classic', quantity: 1, priceTotal: 399, currencyCode: 'INR' },
      { SKU: 'FST-003', name: 'The Seoul Bowl', quantity: 1, priceTotal: 449, currencyCode: 'INR' },
    ]);
  });

  it('does not pretend a non-product event contains items', () => {
    expect(() => readProducts({ message: buildEvent('page-view', null) })).toThrow('requires products');
  });
});
