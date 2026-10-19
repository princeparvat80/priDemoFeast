// Paste this function body into the Core Custom Code data element "AEP - Event XDM".
const websiteEvent = event.message;
if (!websiteEvent || websiteEvent.source !== "feastly-website") {
  throw new Error("AEP - Event XDM requires a Feastly data-layer rule event.");
}

const customer = websiteEvent.customer;
const xdm = {
  _id: websiteEvent.eventId,
  timestamp: websiteEvent.timestamp,
  web: {
    webPageDetails: {
      name: websiteEvent.page.pageName,
      URL: websiteEvent.page.pageUrl
    }
  },
  _aepsupport: {
    attributes: {
      visitorType: customer.isSignedIn ? "returning" : "guest"
    }
  }
};

if (customer.isSignedIn) {
  xdm._aepsupport.attributes.firstName = customer.firstName;
}

const identityMap = _satellite.getVar("AEP - Identity", event);
if (!identityMap || typeof identityMap !== "object" || Array.isArray(identityMap)) {
  throw new Error('Create the Web SDK Identity Map data element named "AEP - Identity".');
}
if (Object.keys(identityMap).length) {
  xdm.identityMap = identityMap;
}

if (websiteEvent.products) {
  xdm.productListItems = websiteEvent.products.map(function (product) {
    return {
      SKU: product.productId,
      name: product.productName,
      quantity: product.quantity,
      priceTotal: product.totalPrice,
      currencyCode: product.currency,
      productCategories: [{ categoryID: product.category }]
    };
  });
}

switch (websiteEvent.event) {
  case "page-view":
    xdm.eventType = "web.webpagedetails.pageViews";
    xdm.web.webPageDetails.pageViews = { value: 1 };
    break;
  case "add-to-cart":
    xdm.eventType = "commerce.productListAdds";
    xdm.commerce = { productListAdds: { value: 1 } };
    break;
  case "remove-from-cart":
    xdm.eventType = "commerce.productListRemovals";
    xdm.commerce = { productListRemovals: { value: 1 } };
    break;
  case "purchase":
    xdm.eventType = "commerce.purchases";
    xdm.commerce = {
      purchases: { value: 1 },
      order: {
        purchaseID: websiteEvent.order.orderId,
        priceTotal: websiteEvent.order.orderTotal,
        currencyCode: websiteEvent.order.currency
      }
    };
    break;
  case "authentication":
    if (websiteEvent.authentication.action === "sign-in") {
      xdm.eventType = "user.login";
    } else if (websiteEvent.authentication.action === "sign-out") {
      xdm.eventType = "user.logout";
    } else {
      throw new Error("Unknown Feastly authentication action.");
    }
    break;
  default:
    throw new Error("Unknown Feastly website event: " + websiteEvent.event);
}

if (websiteEvent.event === "add-to-cart" || websiteEvent.event === "remove-from-cart") {
  const product = websiteEvent.products[0];
  xdm._aepsupport.food = {
    category: product.category,
    cuisine: product.cuisine,
    veg: product.isVegetarian,
    spiceLevel: product.spiceLevel
  };
}

return xdm;
