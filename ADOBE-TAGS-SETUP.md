# Feastly: demonstrate data elements and rule mappings in the UI

## The teaching approach

Do **not** create the former Core Custom Code element `AEP - Event XDM` or paste a full event mapper. That approach has been removed.

Instead, individual data elements read individual website values. Each rule visibly places those elements into the schema using **Web SDK > Update variable**. **Send event** sends the populated native variable.

```text
Website data layer
  -> Website - Page Name data element
  -> Rule's Update variable UI:
       web.webPageDetails.name = %Website - Page Name%
  -> Rule's Send event:
       XDM = %AEP - XDM Variable%
  -> Edge Network -> Datastream -> AEP dataset
```

The website still emits only business-language messages and logs each one under `[Feastly data layer]`. No XDM is added to the website data layer or storefront.

## 1. Create the common source data elements

For each row below, use **Core > Custom Code**, storage **None**, no default value, and no force-lowercase / cleanup settings. Each reader is one line; there is no event-building script.

| Data element name | Reader |
| --- | --- |
| Website - Event ID | `return event.message.eventId;` |
| Website - Timestamp | `return event.message.timestamp;` |
| Website - Page Name | `return event.message.page.pageName;` |
| Website - Page URL | `return event.message.page.pageUrl;` |
| Website - Customer Email | `return event.message.customer.email;` |
| Website - First Name | `return event.message.customer.firstName;` |

Reuse `Website - Customer Email` if you already created it; its earlier sign-in-guarded reader is also valid.

The current website message omits email and first name for guests and sign-out. These readers therefore return undefined. Storage None and no default value prevent retaining a previous shopper's email.

Why not use Adobe Client Data Layer Computed State here? Computed State merges earlier messages and can keep an old email or order after the current event omits it. These readers use the specific message that triggered the rule, including when Tags replays queued messages.

These elements are evaluated within the data-layer rule. Do not test them with `_satellite.getVar` from the console without providing the rule event.

## 2. Keep the native Identity Map element

Use **Adobe Experience Platform Web SDK > Identity Map**, named **AEP - Identity**, storage **None**.

| Identity setting | Value |
| --- | --- |
| Namespace | Standard Email namespace, code `Email` |
| ID | `%Website - Customer Email%` |
| Authenticated state | Authenticated, for this simulated sign-in demo |
| Primary | Checked |

Do not add ECID manually. The native element omits an Email entry when its ID is not a populated string. When Email is present it is primary; otherwise Web SDK / Edge Network supplies ECID and uses it as primary.

This is simulated authentication, not verified ownership of an email address. Use made-up addresses in a development dataset.

## 3. Create a native schema variable, not Custom Code

Create:

| Setting | Value |
| --- | --- |
| Name | **AEP - XDM Variable** |
| Extension | **Adobe Experience Platform Web SDK** |
| Data element type | **Variable** |
| Object type / Property | **XDM** |
| Sandbox | Your schema's sandbox |
| Schema | **Feastly Order Event** |
| Storage | None, if shown |

This is an empty schema-shaped container. It does **not** hide any mapping in code. The rules will fill it using the visible schema editor.

## 4. Build the page-view rule first

Create **Feastly - Page View**:

**Event:** Adobe Client Data Layer > Data Pushed > Listen to specific event > `page-view`; scope **All**.

**Conditions:** none.

**Actions, in this order:**

### Action 1: clear the previous event

Select **Web SDK > Update variable** and choose **AEP - XDM Variable**.

Select the root **xdm** node in the schema editor and enable **Clear** / **Clear the value of this field**. Keep changes. This action only clears the container; do not populate child fields in this action.

The native Variable is mutable and can outlive one event. Explicitly clearing it prevents previous purchase counters, product lines, and Email identities from leaking into the next event.

### Action 2: visibly map the page-view fields

Add **Web SDK > Update variable**, select **AEP - XDM Variable**, and map:

| Schema field in the rule UI | Value / selected data element |
| --- | --- |
| `_id` | `%Website - Event ID%` |
| `timestamp` | `%Website - Timestamp%` |
| `web.webPageDetails.name` | `%Website - Page Name%` |
| `web.webPageDetails.URL` | `%Website - Page URL%` |
| `identityMap` | `%AEP - Identity%` |
| `_aepsupport.attributes.firstName` | `%Website - First Name%` |
| `eventType` | Literal `web.webpagedetails.pageViews` |
| `web.webPageDetails.pageViews.value` | Numeric `1` |

Use the data-element picker for the percentage-wrapped references. For the identityMap object, select the option to supply the object from a data element rather than manually adding an Email subobject. Leave unrelated schema fields empty.

For a guest, undefined first name is omitted, and there is no declared person Email. Do not turn undefined values into the literal strings "undefined" or "null".

### Action 3: send the populated variable

Add **Web SDK > Send event**:

| Setting | Value |
| --- | --- |
| Instance | Your configured SDK instance, normally `alloy` |
| XDM | `%AEP - XDM Variable%` |
| Separate Type / event-type override | Empty |
| Data | Empty |
| Personalization / rendering | Off for this ingestion exercise |

Save. The first rule now clearly shows where every field is populated and which object is sent.

For this simple exercise, keep the default immediate execution of these native actions. Do not introduce asynchronous custom-code actions or split populate/send across several independently triggered rules. The clear, populate, and send actions must stay together in that order for the current message. Verify rapid/queued actions when validating the actual Tags library; a shared mutable variable must not be populated for another event before its current send action captures it.

## 5. Add only the commerce readers when building commerce rules

Create these **Core > Custom Code** elements, storage **None**, no defaults:

| Data element | Reader |
| --- | --- |
| Website - Order ID | `return event.message.order.orderId;` |
| Website - Order Total | `return event.message.order.orderTotal;` |
| Website - Order Currency | `return event.message.order.currency;` |

Use order readers only in the purchase rule, because other website events have no order.

### One small array transformation, not a full event mapper

The website deliberately uses `productId`, `productName`, and `totalPrice`; AEP's product array expects `SKU`, `name`, and `priceTotal`. Also, an order may have one, two, or three product lines.

Create **AEP - Product Items**, **Core > Custom Code**, storage **None**. Paste the small array-only reader from `adobe-tags\product-items.js`:

```javascript
const products = event.message.products;
if (!Array.isArray(products) || !products.length) {
  throw new Error("AEP - Product Items requires products in the current website event.");
}
return products.map(function (product) {
  return {
    SKU: product.productId,
    name: product.productName,
    quantity: product.quantity,
    priceTotal: product.totalPrice,
    currencyCode: product.currency
  };
});
```

This is the only structured transformation. Explain those five product-field translations explicitly. It does not set event type, counters, orders, customer attributes, or identity.

Use it only in add/remove/purchase rules. In each rule's **Update variable** schema editor, select **productListItems > Provide entire array** and choose **%AEP - Product Items%**.

Do not hardcode three product-array slots or send only the first product: those approaches can create empty lines or drop actual purchases.

## 6. Build the add, remove, and purchase rules

Duplicate the page-view rule. Keep its clear action, common mappings, and Send event action. In the population action, **remove** `web.webPageDetails.pageViews.value` and replace the page-view eventType. Do not leave the page-view counter in a cart or purchase event.

| Rule | Specific event | `eventType` literal | Metric field set to numeric `1` |
| --- | --- | --- | --- |
| Feastly - Add to Cart | `add-to-cart` | `commerce.productListAdds` | `commerce.productListAdds.value` |
| Feastly - Remove from Cart | `remove-from-cart` | `commerce.productListRemovals` | `commerce.productListRemovals.value` |
| Feastly - Purchase | `purchase` | `commerce.purchases` | `commerce.purchases.value` |

Map `productListItems` to `%AEP - Product Items%` in all three population actions.

**Purchase only**, also map these visibly:

| Schema field | Data element |
| --- | --- |
| `commerce.order.purchaseID` | `%Website - Order ID%` |
| `commerce.order.priceTotal` | `%Website - Order Total%` |
| `commerce.order.currencyCode` | `%Website - Order Currency%` |

Do not create extra data elements for fixed event types or the constant `1`: enter them directly in the relevant rule.

## 7. Build the authentication rule

Create **Website - Authentication Action**, Core > Custom Code, storage None:

```javascript
return event.message.authentication.action;
```

Create **AEP - Authentication Event Type**, **Core > Conditional Value**, storage None:

- Compare `%Website - Authentication Action%` **Equals** `sign-in`.
- If true: `user.login`.
- If false: `user.logout`.

This translation is visible in the UI; the website only generates those two valid actions.

Duplicate the page-view rule as **Feastly - Authentication**, listen to `authentication`, and remove the page-view counter from its population action. Set its `eventType` to `%AEP - Authentication Event Type%`. Keep the common mappings, clear action, and Send event.

## Optional custom food fields: add only if demonstrating them

The schema's food fields are optional. To demonstrate them on add/remove, create four one-line readers:

| Data element | Reader | Schema mapping in the rule |
| --- | --- | --- |
| Website - Food Category | `return event.message.products[0].category;` | `_aepsupport.food.category` |
| Website - Food Cuisine | `return event.message.products[0].cuisine;` | `_aepsupport.food.cuisine` |
| Website - Is Vegetarian | `return event.message.products[0].isVegetarian;` | `_aepsupport.food.veg` |
| Website - Spice Level | `return event.message.products[0].spiceLevel;` | `_aepsupport.food.spiceLevel` |

Keep storage None and leave defaults unset so Boolean `false` is preserved. Do not map one dish's food fields onto a mixed-cuisine purchase.

Loyalty, city, consent, preferences, visitor history, and ratings are not required to demonstrate this flow and must not be invented.

## Build, connect, and verify

1. Save the elements and five rules, add all changes to a Development library, and build.
2. Set its actual HTTPS install URL in `.env.local` as `VITE_ADOBE_TAGS_URL=...`, then restart Vite. Do not add a duplicate embed script.
3. Confirm the Development Web SDK configuration points to your intended datastream and event dataset.
4. Start in a fresh browser profile: reload, add two bowls, remove one, sign in with a fake email, purchase, and sign out.
5. In each rule, show the field-to-data-element mappings in Update variable, then show the mapped Web SDK event in Network / Adobe Debugger / Assurance.
6. Confirm one appropriate event per website action, full order totals/lines, and no page-view counter on commerce/authentication events. Test a purchase followed by sign-out or another cart action to detect stale order/identity fields.
7. Confirm ingestion in the actual AEP dataset using the order ID and timestamp. Network success alone is not proof of dataset acceptance.

The website's source messages remain business-readable. Schema mapping is visible in the rules, not hidden in a full-event Custom Code element. Sign-out does not erase Adobe cookies or existing identity graphs; use fresh browser profiles for separate demo personas.

References: [Adobe's Update variable action](https://experienceleague.adobe.com/en/docs/experience-platform/tags/extensions/client/web-sdk/actions/update-variable) and [Adobe's UI mapping tutorial](https://experienceleague.adobe.com/en/docs/platform-learn/implement-web-sdk/tags-configuration/create-tag-rule).
