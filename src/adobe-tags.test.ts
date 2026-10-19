import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildEvent, type DataLayerEvent } from './analytics';

const code = readFileSync(new URL('../adobe-tags/feastly-event-xdm.js', import.meta.url), 'utf8');
type MappedEvent = {
  _id: string;
  timestamp: string;
  eventType: string;
  web: { webPageDetails: { name: string; URL: string; pageViews?: { value: number } } };
  _aepsupport: {
    attributes: { visitorType: string; firstName?: string };
    food?: { category: string; cuisine: string; veg: boolean; spiceLevel: string };
  };
  identityMap?: Record<string, { id: string; authenticatedState: string; primary: boolean }[]>;
  commerce?: Record<string, unknown>;
  productListItems?: { SKU: string; name: string; quantity: number; priceTotal: number; currencyCode: string }[];
};
const mapEvent = new Function('event', '_satellite', code) as (
  event: { message: DataLayerEvent },
  satellite: { getVar: (name: string, event: { message: DataLayerEvent }) => unknown },
) => MappedEvent;
const user = { firstName: 'Alex', email: 'alex@example.com' };

function convert(message: DataLayerEvent) {
  const event = { message };
  const identities = message.customer.isSignedIn
    ? { Email: [{ id: message.customer.email, authenticatedState: 'authenticated', primary: true }] }
    : {};
  const getVar = vi.fn().mockReturnValue(identities);
  const original = structuredClone(message);
  const result = mapEvent(event, { getVar });
  expect(getVar).toHaveBeenCalledExactlyOnceWith('AEP - Identity', event);
  expect(message).toEqual(original);
  return result;
}

beforeEach(() => {
  vi.stubGlobal('window', { location: { href: 'http://localhost:5173/' } });
});
afterEach(() => vi.unstubAllGlobals());

describe('paste-ready Adobe Tags mapper', () => {
  it('maps a guest page view without inventing an Email or ECID', () => {
    const message = buildEvent('page-view', null);
    const result = convert(message);
    expect(result).toMatchObject({
      _id: message.eventId,
      timestamp: message.timestamp,
      eventType: 'web.webpagedetails.pageViews',
      web: { webPageDetails: { name: message.page.pageName, URL: message.page.pageUrl, pageViews: { value: 1 } } },
      _aepsupport: { attributes: { visitorType: 'guest' } },
    });
    expect(result.identityMap).toBeUndefined();
    expect(result.commerce).toBeUndefined();
    expect(result.productListItems).toBeUndefined();
  });

  it.each([
    ['add-to-cart', 'commerce.productListAdds', 'productListAdds'],
    ['remove-from-cart', 'commerce.productListRemovals', 'productListRemovals'],
  ] as const)('maps %s, changed quantities, product fields, and custom food details', (event, eventType, metric) => {
    const result = convert(buildEvent(event, user, { items: [{ productId: 'FST-001', quantity: 2 }] }));
    expect(result).toMatchObject({
      eventType,
      commerce: { [metric]: { value: 1 } },
      productListItems: [{ SKU: 'FST-001', name: 'The Green Goddess', quantity: 2, priceTotal: 698, currencyCode: 'INR' }],
      _aepsupport: {
        attributes: { firstName: 'Alex', visitorType: 'returning' },
        food: { category: 'Bowl', cuisine: 'Mediterranean', veg: true, spiceLevel: 'Mild' },
      },
      identityMap: { Email: [{ id: user.email, authenticatedState: 'authenticated', primary: true }] },
    });
  });

  it('maps the complete order without assigning one cuisine to a mixed purchase', () => {
    const result = convert(buildEvent('purchase', user, {
      order: {
        id: 'FST-123456ABCDEF', createdAt: new Date().toISOString(), total: 1147,
        items: [{ productId: 'FST-001', quantity: 2 }, { productId: 'FST-003', quantity: 1 }],
      },
    }));
    expect(result).toMatchObject({
      eventType: 'commerce.purchases',
      commerce: { purchases: { value: 1 }, order: { purchaseID: 'FST-123456ABCDEF', priceTotal: 1147, currencyCode: 'INR' } },
      productListItems: [{ SKU: 'FST-001', quantity: 2, priceTotal: 698 }, { SKU: 'FST-003', quantity: 1, priceTotal: 449 }],
    });
    expect(result._aepsupport.food).toBeUndefined();
  });

  it('maps sign-in then sign-out without carrying the email or commerce fields forward', () => {
    const signIn = convert(buildEvent('authentication', user, { authAction: 'sign-in' }));
    const signOut = convert(buildEvent('authentication', null, { authAction: 'sign-out' }));
    expect(signIn.eventType).toBe('user.login');
    expect(signIn.identityMap?.Email[0].primary).toBe(true);
    expect(signOut.eventType).toBe('user.logout');
    expect(signOut.identityMap).toBeUndefined();
    expect(signOut._aepsupport.attributes.firstName).toBeUndefined();
    expect(signOut.commerce).toBeUndefined();
  });

  it('reports a missing native Identity Map element rather than silently sending partial configuration', () => {
    expect(() => mapEvent({ message: buildEvent('page-view', null) }, { getVar: () => undefined }))
      .toThrow('AEP - Identity');
  });
});
