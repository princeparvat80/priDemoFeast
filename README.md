# Feastly: a beginner-friendly Adobe Data Collection demo

A small React + TypeScript store with **exactly three products** and **five event categories**. Redux Toolkit owns the cart, demo identity, and most recent order. These are saved to `localStorage` and restored after refreshes and browser restarts.

## Run locally

Requires Node.js 22.12+.

```powershell
npm install
npm run dev
```

Open the URL printed by Vite (normally `http://127.0.0.1:5173`). For a production build use `npm run build`, then `npm run preview`.

## Walk through the demo

1. Open the menu: one page-view event is queued.
2. Add a bowl, open the cart, and use its minus/plus buttons. Each actual change queues one add/remove event with the changed quantity, not the whole cart. Quantities are capped at 20 per product.
3. Select **Sign in to checkout**. Enter a made-up name and email. Sign-in queues an authentication event; it does not buy anything automatically.
4. Select **Place order**. The shopper sees a thank-you message, order receipt, and **Shop more** button. The cart is cleared. Behind the scenes, one purchase event contains the complete order, unique order ID, quantities, total, and INR currency.
5. Select **Shop more** to return to the menu. Sign-out queues an authentication event, clears the identity and previous order, and keeps any unpurchased cart items.

The storefront never displays analytics events, JSON, or a debugging panel. Each tracked action prints its exact **website data-layer message** in the browser console under `[Feastly data layer] <event-name>`. Inspect `window.adobeDataLayer` in browser developer tools or capture its messages with the Adobe Client Data Layer extension in Tags. Console messages are independent snapshots, not live objects that change later. They include the demo email after sign-in, so use synthetic data and remove or gate these teaching logs for a real deployment.

The messages use clear website language: `event`, `eventDescription`, `page`, `customer`, `products`, and `order`. A product has `productName`, `quantity`, `unitPrice`, and `totalPrice`. A purchase has `order.orderId` and `order.orderTotal`. Sign-in/out is described by `authentication.action`. **There is no `xdm`, `commerce`, `identityMap`, schema tenant key, or Adobe-specific event type in the website data layer.** The website explains what happened; Tags will separately map those values to the AEP schema.

The menu is the only page. Opening a modal, selecting **Shop more**, or scrolling to the menu is not a page view. A full page reload starts a new queue and queues one new page view. No ratings, search, product-detail, checkout-step, or generic click events are generated.

## Demo identity is not production authentication

There is no backend, real account, password, payment, or delivery. The sign-in is intentionally a browser-only teaching simulation. Anyone with browser access can edit its state; checkout gating is for the demo, not a security boundary. Do not enter real personal data. Clearing this site's browser storage removes the saved profile, cart, and order.

Storage is scoped to the exact origin: `localhost`, `127.0.0.1`, or a different port have different sessions. Already-open tabs each have their own Redux state; reload a tab to pick up another tab's saved state.

## Connect your Adobe Tags property

See [ADOBE-TAGS-SETUP.md](ADOBE-TAGS-SETUP.md). The app queues `window.adobeDataLayer` messages but deliberately includes **no direct Web SDK send calls**, IMS tokens, datastream IDs, or hardcoded Tags library. You configure extensions, data elements, rules, and datastream routing in the Adobe UI.

The data layer works independently of Tags. Locally queued messages are **not evidence of AEP ingestion**. The guide separates the plain-language event contract from Adobe schema mapping and provides the exact **three data elements and five rules** to create. The paste-ready mapper in `adobe-tags\feastly-event-xdm.js` uses the confirmed `_aepsupport` tenant key and belongs in a Tags Custom Code data element, not in the website bundle. The previous `return event.message.xdm;` instruction is obsolete: the website no longer emits an XDM object.

Email is trimmed and lowercased by the website and omitted for guests and sign-out. At the Adobe mapping stage, a native Web SDK Identity Map data element uses a nonempty current-message email as primary; otherwise Web SDK / Edge Network supplies ECID and uses it as primary. No ECID or Adobe identity structure is fabricated in the website message.

## Project structure

| File | Purpose |
| --- | --- |
| `src/catalog.ts` | The three products, price helpers, shared types |
| `src/store.ts` | Redux state, validated restoration, persistence, action-driven event tracking |
| `src/analytics.ts` | The five categories and typed, plain-language website data-layer builder |
| `adobe-tags\feastly-event-xdm.js` | Paste-ready Tags mapping to the confirmed `_aepsupport` schema; not loaded by the storefront |
| `src/App.tsx` | Menu, cart, demo sign-in, thank-you receipt, and Shop more |
| `src/styles.css` | Responsive layout and accessible focus/reduced-motion styles |
| `.env.example` | Optional Tags library embed URL |

Website messages contain known product details and signed-in customer information. Profile preferences, consent, loyalty, city, and ratings are not fabricated. Custom schema keys and field names belong to the later Adobe mapping, not these messages.

Food photography is stored locally in `public/images`, downloaded from Unsplash. Images are illustrative, not nutritional or ingredient guarantees; listed calories are demo values. Font styles optionally load from Google Fonts, with system fallbacks when offline.

## Checks

```powershell
npm test
npx playwright install chromium
npm run test:e2e
npm run build
```

Unit tests cover event shapes, quantities, order totals, authentication gating, and saved-state validation. Browser tests cover the complete shopping flow, refresh persistence, duplicate-purchase prevention, the exact five event categories, mobile overflow, image loading, keyboard dismissal, and storage failure feedback.
