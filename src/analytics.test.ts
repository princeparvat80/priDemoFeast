// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildEvent, initializeDataLayer, track } from './analytics';

const user = { firstName: 'Alex', email: 'alex@example.com' };

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.stubGlobal('window', { location: { href: 'http://localhost:5173/' } });
  initializeDataLayer();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('the five website event types', () => {
  it('describes a page view using website language only', () => {
    const event = buildEvent('page-view', null);
    expect(event).toMatchObject({
      source: 'feastly-website',
      event: 'page-view',
      eventDescription: 'Viewed the menu',
      page: { pageName: 'Feastly | Menu', pageUrl: 'http://localhost:5173/' },
      customer: { isSignedIn: false },
    });
    expect(event.eventId).toBeTruthy();
    expect(Number.isFinite(Date.parse(event.timestamp))).toBe(true);
    expect(event).not.toHaveProperty('products');
    expect(event).not.toHaveProperty('order');
  });

  it.each(['add-to-cart', 'remove-from-cart'] as const)('describes %s with changed quantity and clearly named prices', (name) => {
    const event = buildEvent(name, user, { items: [{ productId: 'FST-001', quantity: 2 }] });
    expect(event).toMatchObject({
      event: name,
      customer: { isSignedIn: true, firstName: 'Alex', email: user.email },
      products: [{
        productId: 'FST-001', productName: 'The Green Goddess',
        quantity: 2, unitPrice: 349, totalPrice: 698, currency: 'INR',
        category: 'Bowl', cuisine: 'Mediterranean', isVegetarian: true, spiceLevel: 'Mild',
      }],
    });
    expect(event).not.toHaveProperty('order');
  });

  it('describes a purchase with all products and a clearly named order total', () => {
    const event = buildEvent('purchase', user, {
      order: {
        id: 'FST-123456ABCDEF',
        createdAt: new Date().toISOString(),
        total: 1097,
        items: [{ productId: 'FST-001', quantity: 2 }, { productId: 'FST-002', quantity: 1 }],
      },
    });
    expect(event).toMatchObject({
      event: 'purchase',
      order: { orderId: 'FST-123456ABCDEF', orderTotal: 1097, currency: 'INR' },
      products: [
        { productId: 'FST-001', quantity: 2, unitPrice: 349, totalPrice: 698 },
        { productId: 'FST-002', quantity: 1, unitPrice: 399, totalPrice: 399 },
      ],
    });
    expect(event).not.toHaveProperty('food');
    expect(() => buildEvent('purchase', null)).toThrow();
    expect(() => buildEvent('purchase', user, {
      order: { id: 'bad', createdAt: '', total: 1, items: [{ productId: 'FST-001', quantity: 1 }] },
    })).toThrow('total');
  });

  it('explicitly describes sign-in and sign-out within the authentication category', () => {
    expect(buildEvent('authentication', user, { authAction: 'sign-in' })).toMatchObject({
      event: 'authentication',
      authentication: { action: 'sign-in' },
      customer: { isSignedIn: true, email: user.email },
    });
    expect(buildEvent('authentication', null, { authAction: 'sign-out' })).toMatchObject({
      event: 'authentication',
      authentication: { action: 'sign-out' },
      customer: { isSignedIn: false },
    });
    expect(() => buildEvent('authentication', null, { authAction: 'sign-in' })).toThrow('email');
    expect(() => buildEvent('authentication', user)).toThrow('action');
  });

  it('normalizes customer email without exposing Adobe identity terminology', () => {
    const event = buildEvent('page-view', { firstName: 'Alex', email: '  Alex@Example.com ' });
    expect(event.customer).toEqual({
      isSignedIn: true, firstName: 'Alex', email: 'alex@example.com',
    });
  });

  it('does not send an empty customer email', () => {
    const event = buildEvent('page-view', { firstName: 'Alex', email: '   ' });
    expect(event.customer).toEqual({ isSignedIn: false });
  });

  it('keeps schema fields out of every website event category', () => {
    const events = [
      buildEvent('page-view', null),
      buildEvent('add-to-cart', user, { items: [{ productId: 'FST-001', quantity: 1 }] }),
      buildEvent('remove-from-cart', user, { items: [{ productId: 'FST-002', quantity: 1 }] }),
      buildEvent('authentication', user, { authAction: 'sign-in' }),
      buildEvent('authentication', null, { authAction: 'sign-out' }),
      buildEvent('purchase', user, {
        order: { id: 'FST-123456ABCDEF', createdAt: '', total: 449, items: [{ productId: 'FST-003', quantity: 1 }] },
      }),
    ];
    for (const event of events) {
      expect(JSON.stringify(event)).not.toMatch(
        /"(?:xdm|eventType|identityMap|_id|commerce|webPageDetails|productListItems|SKU|priceTotal|currencyCode|_feastly)"\s*:/,
      );
    }
  });

  it('requires nonempty cart changes and positive whole-number quantities', () => {
    expect(() => buildEvent('add-to-cart', user)).toThrow('changed items');
    expect(() => buildEvent('remove-from-cart', user, { items: [] })).toThrow('changed items');
    for (const quantity of [0, -1, 1.5]) {
      expect(() => buildEvent('add-to-cart', user, { items: [{ productId: 'FST-001', quantity }] })).toThrow('quantity');
    }
  });

  it('logs an independent snapshot of exactly the website message pushed', () => {
    const event = track('add-to-cart', user, { items: [{ productId: 'FST-001', quantity: 1 }] });
    expect(console.log).toHaveBeenCalledExactlyOnceWith('[Feastly data layer] add-to-cart', event);
    const snapshot = vi.mocked(console.log).mock.calls[0][1];
    expect(snapshot).not.toBe(event);
    event.page.pageName = 'Changed after push';
    expect(snapshot.page.pageName).toBe('Feastly | Menu');
    if (event.event !== 'add-to-cart') throw new Error('Expected an add-to-cart event.');
    event.products[0].quantity = 20;
    expect(snapshot.products[0].quantity).toBe(1);
  });

  it('pushes a standalone website message to the Adobe data-layer queue', () => {
    const event = track('page-view', null);
    expect(window.adobeDataLayer).toEqual([event]);
  });

  it('preserves an existing queue and a Tags-provided push implementation', () => {
    const queue: typeof window.adobeDataLayer = [];
    const push = vi.spyOn(queue, 'push');
    window.adobeDataLayer = queue;
    initializeDataLayer();
    const event = track('page-view', null);
    expect(window.adobeDataLayer).toBe(queue);
    expect(push).toHaveBeenCalledExactlyOnceWith(event);
  });
});
