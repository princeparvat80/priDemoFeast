import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { actions, readSavedState, shopReducer, STORAGE_KEY, type ShopState } from './store';

const initial = (): ShopState => ({ cart: [], user: null, lastOrder: null, persistenceError: null });
const memory = vi.hoisted(() => {
  const saved = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => saved.get(key) ?? null,
    setItem: (key: string, value: string) => saved.set(key, value),
  });
  return saved;
});
beforeEach(() => {
  memory.clear();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => memory.set(key, value),
  });
});
afterEach(() => vi.unstubAllGlobals());

describe('cart and demo authentication', () => {
  it('adds, increments, removes, and caps quantities at 20', () => {
    let state = initial();
    for (let index = 0; index < 25; index++) state = shopReducer(state, actions.added('FST-001'));
    expect(state.cart).toEqual([{ productId: 'FST-001', quantity: 20 }]);
    for (let index = 0; index < 21; index++) state = shopReducer(state, actions.removed('FST-001'));
    expect(state.cart).toEqual([]);
  });
  it('does not purchase as a guest or buy an empty cart', () => {
    const guest = shopReducer(initial(), actions.added('FST-001'));
    expect(shopReducer(guest, actions.purchased())).toEqual(guest);
    const signedIn = shopReducer(initial(), actions.signedIn({ firstName: 'Alex', email: 'alex@example.com' }));
    expect(shopReducer(signedIn, actions.purchased())).toEqual(signedIn);
  });
  it('snapshots the order, clears the cart, and cannot buy it twice', () => {
    let state = shopReducer(initial(), actions.added('FST-003'));
    state = shopReducer(state, actions.signedIn({ firstName: 'Alex', email: 'alex@example.com' }));
    state = shopReducer(state, actions.purchased());
    expect(state.lastOrder?.total).toBe(449);
    expect(state.lastOrder?.items).toEqual([{ productId: 'FST-003', quantity: 1 }]);
    expect(state.cart).toEqual([]);
    expect(shopReducer(state, actions.purchased())).toEqual(state);
  });
  it('keeps the cart but removes the demo identity on sign-out', () => {
    let state = shopReducer(initial(), actions.added('FST-002'));
    state = shopReducer(state, actions.signedIn({ firstName: 'Alex', email: 'alex@example.com' }));
    state = shopReducer(state, actions.signedOut());
    expect(state.user).toBeNull();
    expect(state.cart).toHaveLength(1);
  });
  it('rejects invalid demo identities', () => {
    expect(() => shopReducer(initial(), actions.signedIn({ firstName: ' ', email: 'bad' }))).toThrow();
  });
});

describe('local storage restoration', () => {
  it('restores a valid cart and identity', () => {
    const saved = { ...initial(), cart: [{ productId: 'FST-001', quantity: 2 }], user: { firstName: 'Alex', email: 'alex@example.com' } };
    memory.set(STORAGE_KEY, JSON.stringify(saved));
    expect(readSavedState()).toEqual(saved);
  });
  it.each(['{bad', JSON.stringify({ cart: [{ productId: 'unknown', quantity: 2 }], user: null, lastOrder: null }),
    JSON.stringify({ cart: [{ productId: 'FST-001', quantity: -2 }], user: null, lastOrder: null })])(
    'reports invalid persisted data rather than trusting it', (raw) => {
      const log = vi.spyOn(console, 'error').mockImplementation(() => {});
      memory.set(STORAGE_KEY, raw);
      expect(readSavedState().persistenceError).toContain('could not be restored');
      expect(log).toHaveBeenCalled();
      log.mockRestore();
    },
  );
});
