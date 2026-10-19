// Only for the "AEP - Product Items" data element, used by cart and purchase rules.
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
