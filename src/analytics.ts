import { getProduct, totalFor, type CartItem, type User, type Order } from './catalog';

export type EventName = 'page-view' | 'add-to-cart' | 'remove-from-cart' | 'purchase' | 'authentication';
export type DataLayerProduct = {
  productId: string;
  productName: string;
  category: string;
  cuisine: string;
  isVegetarian: boolean;
  spiceLevel: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  currency: 'INR';
};

type Customer = { isSignedIn: false } | { isSignedIn: true; firstName: string; email: string };

type EventContext = {
  source: 'feastly-website';
  eventId: string;
  timestamp: string;
  eventDescription: string;
  page: { pageName: string; pageUrl: string };
  customer: Customer;
};

export type DataLayerEvent = EventContext & (
  | { event: 'page-view' }
  | { event: 'add-to-cart' | 'remove-from-cart'; products: DataLayerProduct[] }
  | { event: 'purchase'; products: DataLayerProduct[]; order: { orderId: string; orderTotal: number; currency: 'INR' } }
  | { event: 'authentication'; authentication: { action: 'sign-in' | 'sign-out' } }
);

declare global {
  interface Window {
    adobeDataLayer: DataLayerEvent[];
  }
}

export function initializeDataLayer() {
  window.adobeDataLayer = window.adobeDataLayer || [];
}

function productItems(items: CartItem[]): DataLayerProduct[] {
  return items.map(({ productId, quantity }) => {
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new Error('An event product requires a positive whole-number quantity.');
    }
    const product = getProduct(productId);
    return {
      productId: product.id,
      productName: product.name,
      category: product.category,
      cuisine: product.cuisine,
      isVegetarian: product.veg,
      spiceLevel: product.spiceLevel,
      quantity,
      unitPrice: product.price,
      totalPrice: product.price * quantity,
      currency: 'INR',
    };
  });
}

export function buildEvent(
  event: EventName,
  user: User | null,
  details: { items?: CartItem[]; order?: Order; authAction?: 'sign-in' | 'sign-out' } = {},
): DataLayerEvent {
  const email = user?.email.trim().toLowerCase();
  const context: Omit<EventContext, 'eventDescription'> = {
    source: 'feastly-website',
    eventId: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    page: {
      pageName: 'Feastly | Menu',
      pageUrl: window.location.href,
    },
    customer: user && email
      ? { isSignedIn: true, firstName: user.firstName, email }
      : { isSignedIn: false },
  };
  switch (event) {
    case 'page-view':
      return { ...context, event, eventDescription: 'Viewed the menu' };
    case 'add-to-cart':
    case 'remove-from-cart': {
      const items = details.items;
      if (!items?.length) throw new Error('A cart event requires changed items.');
      const adding = event === 'add-to-cart';
      const products = productItems(items);
      return {
        ...context,
        event,
        eventDescription: `${adding ? 'Added' : 'Removed'} ${products[0].productName} ${adding ? 'to' : 'from'} the cart`,
        products,
      };
    }
    case 'purchase': {
      const order = details.order;
      if (!context.customer.isSignedIn || !order?.items.length) throw new Error('A purchase requires a signed-in user and a nonempty order.');
      if (order.total !== totalFor(order.items)) throw new Error('Order total does not match its items.');
      return {
        ...context,
        event,
        eventDescription: `Placed order ${order.id}`,
        products: productItems(order.items),
        order: { orderId: order.id, orderTotal: order.total, currency: 'INR' },
      };
    }
    case 'authentication':
      if (!details.authAction) throw new Error('An authentication event requires an action.');
      if (details.authAction === 'sign-in' && !context.customer.isSignedIn) {
        throw new Error('A sign-in event requires a customer email.');
      }
      return {
        ...context,
        event,
        eventDescription: details.authAction === 'sign-in' ? 'Signed in to the website' : 'Signed out of the website',
        authentication: { action: details.authAction },
      };
  }
}

export function track(
  ...args: Parameters<typeof buildEvent>
) {
  const payload = buildEvent(...args);
  const snapshot = structuredClone(payload);
  window.adobeDataLayer.push(payload);
  console.log(`[Feastly data layer] ${snapshot.event}`, snapshot);
  return payload;
}
