# Feastly website data layer and Adobe Tags

## First teach the website data layer

The website now speaks only in business terms. Every message in `window.adobeDataLayer` describes something a shopper did. It does **not** contain an `xdm` object, schema tenant keys, `commerce`, `identityMap`, or Adobe-specific event types.

The variable is called `adobeDataLayer` so the Adobe Client Data Layer extension can listen to it. That name does not mean its contents must already match an AEP schema.

```text
Website action
  -> Clear website message
  -> Browser console
  -> Tags reads the website fields
  -> Tags maps those fields to the AEP schema
  -> Web SDK sends XDM to Adobe Edge
  -> Datastream routes it to the AEP dataset
```

Introduce the AEP schema only at the mapping step, not while explaining the website messages.

**Important change:** the old instruction `return event.message.xdm;` no longer applies. There is intentionally no `xdm` field in the website data layer. The former `VITE_XDM_TENANT_KEY` website setting and `window.feastly` configuration object have been removed; the actual schema and tenant key belong to the Adobe mapping configuration.

The data layer and paste-ready Tags mapper are ready. The confirmed schema tenant key is **`_aepsupport`**. Adobe ingestion still requires creating the three data elements and five rules below, building a Tags library, and connecting that library. Do not send a raw website message directly as the Web SDK XDM object.

## See each message

1. Open `http://127.0.0.1:5173`.
2. Open browser developer tools with **F12** and select **Console**.
3. Enable **Info / Logs** and filter by `[Feastly data layer]`.
4. Reload, add a dish, remove one, sign in, and place an order.
5. Expand the message beside each log label.

The console prints an independent snapshot of exactly what the website pushed. Nothing technical appears on the storefront.

## Naming convention

Event names are lowercase, hyphen-separated actions. Fields use camelCase and descriptive business names.

| Field | Meaning |
| --- | --- |
| `source` | Always `feastly-website`: where the message came from |
| `event` | What action happened, such as `add-to-cart` |
| `eventDescription` | A sentence explaining the action |
| `eventId` | Unique ID for this occurrence, not a customer ID |
| `timestamp` | When the action happened, in ISO UTC format |
| `page.pageName` | Name of the website page |
| `page.pageUrl` | URL where the action happened |
| `customer.isSignedIn` | Whether the shopper has signed in to the demo |
| `customer.firstName` | Signed-in shopper's first name |
| `customer.email` | Signed-in shopper's trimmed, lowercase demo email |
| `products` | The products involved in this specific action |
| `products[].productId` | Stable catalog identifier |
| `products[].productName` | Human-readable dish name |
| `products[].quantity` | Quantity involved in this action |
| `products[].unitPrice` | Price of one bowl |
| `products[].totalPrice` | `quantity × unitPrice` for that product |
| `products[].currency` | Currency of these prices, currently `INR` |
| `products[].category` | Product category, currently `Bowl` |
| `products[].cuisine` | Cuisine of that particular product |
| `products[].isVegetarian` | Whether that product is vegetarian |
| `products[].spiceLevel` | Product's spice level |
| `order.orderId` | Unique ID of the completed order |
| `order.orderTotal` | Total price of all purchased products |
| `order.currency` | Order currency |
| `authentication.action` | `sign-in` or `sign-out` |

## The five events

| Event | When it is pushed | Additional fields |
| --- | --- | --- |
| `page-view` | Initial homepage load or full reload | Common page and customer context only |
| `add-to-cart` | A product quantity actually increases | `products`: the added quantity, not the entire cart |
| `remove-from-cart` | A product quantity actually decreases | `products`: the removed quantity |
| `purchase` | A signed-in shopper places a nonempty order | All purchased `products`, plus `order` |
| `authentication` | Successful demo sign-in or sign-out | `authentication.action` |

Every event has its own page and customer snapshot. Optional sections are absent when irrelevant. Page view does not contain an order. Guest and sign-out messages contain `customer: { isSignedIn: false }` and no email or first name.

The cart and thank-you receipt are overlays, not separate pages. Opening them or selecting Shop more does not emit a new page-view event. A no-op such as adding above the quantity cap does not emit a misleading cart event.

## Example: adding one bowl

This is an illustrative message; the ID and timestamp are generated at runtime.

```json
{
  "source": "feastly-website",
  "eventId": "a-unique-event-id",
  "timestamp": "2026-10-19T13:20:00.000Z",
  "page": {
    "pageName": "Feastly | Menu",
    "pageUrl": "http://127.0.0.1:5173/"
  },
  "customer": {
    "isSignedIn": false
  },
  "event": "add-to-cart",
  "eventDescription": "Added The Green Goddess to the cart",
  "products": [
    {
      "productId": "FST-001",
      "productName": "The Green Goddess",
      "category": "Bowl",
      "cuisine": "Mediterranean",
      "isVegetarian": true,
      "spiceLevel": "Mild",
      "quantity": 1,
      "unitPrice": 349,
      "totalPrice": 349,
      "currency": "INR"
    }
  ]
}
```

When that bowl is purchased, `event` becomes `purchase`, `products` contains the purchased quantities, and an `order` section contains `orderId`, `orderTotal`, and `currency`. An authentication message uses `authentication.action` rather than an Adobe event type.

## Create only these three data elements

Prerequisites: Core, Adobe Client Data Layer, and Adobe Experience Platform Web SDK extensions are installed. Web SDK's Development environment uses your intended datastream; its AEP service routes to your Feastly event dataset.

For **all three elements**, select storage duration **None**, leave the default value unset, and leave text cleanup / force lowercase options off. Use the names exactly as written because the mapper references `AEP - Identity`.

### 1. Website - Customer Email

Go to **Data Elements > Add data element**:

| Setting | Value |
| --- | --- |
| Name | `Website - Customer Email` |
| Extension | Core |
| Type | Custom Code |

Paste:

```javascript
return event.message.customer.isSignedIn
  ? event.message.customer.email
  : undefined;
```

Save. This reads the current rule message, not merged state. Guest and sign-out events yield no email, so a previous sign-in cannot accidentally supply it.

### 2. AEP - Identity

Create:

| Setting | Value |
| --- | --- |
| Name | `AEP - Identity` |
| Extension | Adobe Experience Platform Web SDK |
| Type | Identity Map |

Add **one identity**:

| Identity setting | Value |
| --- | --- |
| Namespace | Standard Email namespace, code `Email` |
| ID | `%Website - Customer Email%` |
| Authenticated state | Authenticated, for this simulated sign-in demo |
| Primary | Checked |

Save. Do not manually add ECID. The native Identity Map element omits an identifier when its ID is not a populated string. Consequently, Email becomes primary when present; otherwise Web SDK / Edge Network provides ECID and uses it as primary. Use synthetic emails: this website does not verify ownership of an address.

### 3. AEP - Event XDM

Create:

| Setting | Value |
| --- | --- |
| Name | `AEP - Event XDM` |
| Extension | Core |
| Type | Custom Code |

Open `adobe-tags\feastly-event-xdm.js` in this project and copy the **entire file contents** into the Custom Code editor. Save.

This is a Tags data-element function body, not a script to import into the website or run directly with Node. It maps the current message to your `_aepsupport` schema, maps every product in the order, obtains the native identity object using `_satellite.getVar("AEP - Identity", event)`, and selects the correct event type and commerce metric. It builds a fresh object each time and never changes the website message.

The dependency flow is:

```text
Website - Customer Email -> AEP - Identity -> AEP - Event XDM -> Send Event
```

No separate data elements for every SKU, amount, cuisine, or page field are required. The mapping is shared across all five rules.

Do not evaluate these event-dependent elements from the console without a rule event. They are designed to execute inside Adobe Client Data Layer rules.

## Create the five rules

Start with **Rules > Add rule** named **Feastly - Page View**.

**Event**

1. Extension: **Adobe Client Data Layer**.
2. Type: **Data Pushed**.
3. Choose **Listen to specific event** and enter `page-view`.
4. Scope: **All** (past and future), so the initial queued page view is not missed.
5. Keep changes.

**Conditions:** none are required for these dedicated rules.

**Action**

1. Extension: **Adobe Experience Platform Web SDK**.
2. Type: **Send Event**.
3. Instance: your configured instance, normally `alloy`.
4. XDM: `%AEP - Event XDM%`, selected using the data-element picker.
5. Leave a separate Type / event-type override empty. The mapper already sets `eventType`.
6. Leave Data empty; leave personalization/rendering options off for the ingestion demo.
7. Keep changes and save the rule.

Duplicate that rule four times. Change only the rule name and specific event name:

| Rule name | Specific data-layer event | Mapped XDM event type |
| --- | --- | --- |
| Feastly - Page View | `page-view` | `web.webpagedetails.pageViews` |
| Feastly - Add to Cart | `add-to-cart` | `commerce.productListAdds` |
| Feastly - Remove from Cart | `remove-from-cart` | `commerce.productListRemovals` |
| Feastly - Purchase | `purchase` | `commerce.purchases` |
| Feastly - Authentication | `authentication` | `user.login` / `user.logout` |

Each rule has **one matching event and one Send Event action**. Do not add a second XDM-object mapping, a computed-state sending rule, DOM Ready page view, generic button-click sending rule, or separate `alloy("sendEvent")` call.

**Why not use Computed State for email or the full payload?** It merges messages and can keep old email or purchase values. All three elements above use the current rule message and storage None, so queued guest events, sign-in, purchase, and sign-out keep their own correct context.

## Mapping reference for the team

The mapper performs this translation inside Tags, never in the website data layer:

| Website concept | AEP schema destination |
| --- | --- |
| `eventId` | `_id` |
| `timestamp` | `timestamp` |
| `page.pageName` | `web.webPageDetails.name` |
| `page.pageUrl` | `web.webPageDetails.URL` |
| `products[].productId` | `productListItems[].SKU` |
| `products[].productName` | `productListItems[].name` |
| `products[].quantity` | `productListItems[].quantity` |
| `products[].totalPrice` | `productListItems[].priceTotal` |
| `products[].currency` | `productListItems[].currencyCode` |
| `order.orderId` | `commerce.order.purchaseID` |
| `order.orderTotal` | `commerce.order.priceTotal` |
| `order.currency` | `commerce.order.currencyCode` |
| `customer.firstName` | Your actual tenant's `attributes.firstName` |
| Changed product's cuisine, category, vegetarian flag, spice level | Your tenant's corresponding `food` fields on add/remove |
| `customer.email` | Email namespace in `identityMap`, when available |

The mapper also sets the appropriate page-view or commerce counter to `{ value: 1 }`. Purchase uses all product lines and the complete order total. Add/remove use only the changed quantity. A mixed-cuisine purchase does not assign one product's food fields to the whole order.

The `_aepsupport.attributes.visitorType` teaching value is `guest` or `returning` (meaning signed-in here, not historical visit counting). Only known custom fields are populated. Loyalty, marketing consent, city, preferences, and ratings are omitted.

Select the actual **Feastly Order Event** schema and corresponding dataset in the intended sandbox. Use the real tenant key from that schema, not the placeholder in the original export. Prefer a development sandbox. If demonstrating Profile, both the schema and dataset must be Profile-enabled.

## Build and connect the Development library

1. Go to **Publishing Flow > Add library**.
2. Name it `Feastly - First events` and select your Development environment.
3. Add all changed extensions, the three data elements, and the five rules.
4. Select **Save & Build for Development** and wait for success.
5. Open **Environments**, find that Development environment, and copy the HTTPS script URL from its installation instructions.
6. Supply only that URL, not the entire script tag, in `.env.local`:

```dotenv
VITE_ADOBE_TAGS_URL=https://assets.adobedtm.com/your-actual-development-library.js
```

Restart Vite after changing this file. The application loads that URL once; do not add a duplicate script to `index.html`. No tenant setting or schema metadata is needed to generate website messages. Rebuild the Development library after later rule or data-element changes.

## Verify the first implementation

Start in a fresh browser profile and use made-up customer information. Enable Tags logging with `_satellite.setDebug(true)` if needed. In browser Network tools, filter for `interact` or `adobedc` and enable Preserve log.

1. Reload: one website page view, the page-view rule, and its Web SDK event.
2. Add two bowls: add events with the correct changed quantities and prices.
3. Remove one: a removal event for the removed bowl.
4. Sign in: an authentication event with primary Email.
5. Place the order: one purchase event with the correct order ID, total, and purchased lines.
6. Sign out: an authentication event without a declared Email; the SDK still manages ECID.

Check the mapped payload, not only rule logs. SDK requests can batch events, so count event records rather than assuming one request always equals one event. Confirm `configId` routes to the intended datastream. After ingestion catches up, inspect/query the intended dataset using the purchase ID and timestamp.

A console log proves the website emitted a message, not that Adobe accepted it. Later, verify mapped Web SDK requests with browser Network tools / Adobe Debugger / Assurance, then confirm dataset ingestion using the purchase ID and timestamp.

This remains a local demo sign-in, not verified authentication. Use made-up emails. Sign-out removes identity from subsequent website messages, but does not erase Adobe cookies or existing identity graphs. Use a fresh browser profile between independent demo personas. Remove or gate the email-containing console logs before a real deployment.
