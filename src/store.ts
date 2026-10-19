import { configureStore, createSlice, type Middleware, type PayloadAction } from '@reduxjs/toolkit';
import { products, totalFor, type CartItem, type ProductId, type User, type Order } from './catalog';
import { track } from './analytics';

export const STORAGE_KEY = 'feastly.demo.v1';
const MAX_QUANTITY = 20;

export type ShopState = {
  cart: CartItem[];
  user: User | null;
  lastOrder: Order | null;
  persistenceError: string | null;
};

export function readSavedState(): ShopState {
  const initial: ShopState = { cart: [], user: null, lastOrder: null, persistenceError: null };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initial;
    const data: unknown = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) throw new Error('Invalid saved session.');
    const saved = data as Record<string, unknown>;
    if (!Array.isArray(saved.cart) || !validItems(saved.cart)) throw new Error('Invalid saved cart.');
    if (saved.user !== null && !validUser(saved.user)) throw new Error('Invalid saved profile.');
    if (saved.lastOrder !== null && !validOrder(saved.lastOrder)) throw new Error('Invalid saved order.');
    return {
      ...initial,
      cart: saved.cart,
      user: saved.user as User | null,
      lastOrder: saved.lastOrder as Order | null,
    };
  } catch (error) {
    console.error('Feastly could not restore the saved demo session.', error);
    return { ...initial, persistenceError: 'Your saved session could not be restored. This tab is starting fresh.' };
  }
}

function validItems(value: unknown[]): value is CartItem[] {
  const seen = new Set<string>();
  return value.every((item: unknown) => {
    if (!item || typeof item !== 'object') return false;
    const entry = item as Record<string, unknown>;
    if (typeof entry.productId !== 'string' || seen.has(entry.productId)
      || !products.some((product) => product.id === entry.productId)
      || typeof entry.quantity !== 'number' || !Number.isInteger(entry.quantity)
      || entry.quantity < 1 || entry.quantity > MAX_QUANTITY) return false;
    seen.add(entry.productId);
    return true;
  });
}

function validUser(value: unknown): value is User {
  if (!value || typeof value !== 'object') return false;
  const user = value as Record<string, unknown>;
  return typeof user.firstName === 'string' && user.firstName.trim().length > 0
    && user.firstName.length <= 40 && typeof user.email === 'string'
    && user.email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email);
}

function validOrder(value: unknown): value is Order {
  if (!value || typeof value !== 'object') return false;
  const order = value as Record<string, unknown>;
  return typeof order.id === 'string' && /^FST-[A-F0-9]{12}$/.test(order.id)
    && typeof order.createdAt === 'string' && Number.isFinite(Date.parse(order.createdAt))
    && Array.isArray(order.items) && order.items.length > 0 && validItems(order.items)
    && order.total === totalFor(order.items);
}

const shopSlice = createSlice({
  name: 'shop',
  initialState: readSavedState,
  reducers: {
    added(state, action: PayloadAction<ProductId>) {
      const item = state.cart.find((entry) => entry.productId === action.payload);
      if (item && item.quantity < MAX_QUANTITY) item.quantity += 1;
      else if (!item && products.some((product) => product.id === action.payload)) {
        state.cart.push({ productId: action.payload, quantity: 1 });
      }
    },
    removed(state, action: PayloadAction<ProductId>) {
      const item = state.cart.find((entry) => entry.productId === action.payload);
      if (!item) return;
      item.quantity -= 1;
      state.cart = state.cart.filter((entry) => entry.quantity > 0);
    },
    signedIn(state, action: PayloadAction<User>) {
      if (!validUser(action.payload)) throw new Error('Please enter a valid demo name and email.');
      state.user = action.payload;
    },
    signedOut(state) {
      state.user = null;
      state.lastOrder = null;
    },
    purchased: {
      prepare() {
        return { payload: { id: `FST-${crypto.randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`, createdAt: new Date().toISOString() } };
      },
      reducer(state, action: PayloadAction<{ id: string; createdAt: string }>) {
        if (!state.user || !state.cart.length) return;
        state.lastOrder = {
          ...action.payload,
          items: state.cart.map((item) => ({ ...item })),
          total: totalFor(state.cart),
        };
        state.cart = [];
      },
    },
    storageFailed(state, action: PayloadAction<string>) {
      state.persistenceError = action.payload;
    },
  },
});

export const actions = shopSlice.actions;
export const shopReducer = shopSlice.reducer;

const effects: Middleware<{}, { shop: ShopState }> = (api) => (next) => (action) => {
  const previous = api.getState().shop;
  const result = next(action);
  const current = api.getState().shop;

  if (actions.added.match(action) || actions.removed.match(action)) {
    const before = previous.cart.find((item) => item.productId === action.payload)?.quantity ?? 0;
    const after = current.cart.find((item) => item.productId === action.payload)?.quantity ?? 0;
    if (before !== after) {
      track(after > before ? 'add-to-cart' : 'remove-from-cart', current.user, {
        items: [{ productId: action.payload, quantity: Math.abs(after - before) }],
      });
    }
  } else if (actions.signedIn.match(action)) {
    track('authentication', current.user, { authAction: 'sign-in' });
  } else if (actions.signedOut.match(action) && previous.user) {
    track('authentication', null, { authAction: 'sign-out' });
  } else if (actions.purchased.match(action) && current.lastOrder !== previous.lastOrder && current.lastOrder) {
    track('purchase', current.user, { order: current.lastOrder });
  }

  if (previous.cart !== current.cart || previous.user !== current.user || previous.lastOrder !== current.lastOrder) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        cart: current.cart, user: current.user, lastOrder: current.lastOrder,
      }));
    } catch (error) {
      console.error('Feastly could not save the demo session.', error);
      api.dispatch(actions.storageFailed('Browser storage is unavailable. Your session works in this tab, but may not survive a refresh.'));
    }
  }
  return result;
};

export const store = configureStore({
  reducer: { shop: shopReducer },
  middleware: (getDefault) => getDefault().concat(effects),
});
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
