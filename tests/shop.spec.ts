import { test, expect } from '@playwright/test';

test('complete beginner demo: all five event types, persistence, checkout gate, and sign-out', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Good food.');
  await expect(page.locator('.product-card')).toHaveCount(3);
  await expect.poll(() => page.evaluate(() => window.adobeDataLayer.length)).toBe(1);
  await expect(page.getByRole('button', { name: /Event explorer|See the purchase event|Copy JSON/i })).toHaveCount(0);
  await expect(page.locator('pre')).toHaveCount(0);
  await page.getByRole('button', { name: 'Add The Green Goddess to cart', exact: true }).click();
  await page.getByRole('button', { name: 'Add The Comfort Classic to cart', exact: true }).click();
  await page.getByRole('button', { name: 'Open cart, 2 items', exact: true }).click();
  await page.getByRole('button', { name: 'Remove one The Comfort Classic', exact: true }).click();
  await expect(page.locator('.total-row')).toContainText('349');
  await page.getByRole('button', { name: 'Sign in to checkout', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Place order' })).toHaveCount(0);
  await page.getByLabel('First name', { exact: true }).fill('Alex');
  await page.getByLabel('Email address', { exact: true }).fill('alex@example.com');
  await page.getByRole('button', { name: "Let's dig in", exact: true }).click();
  await expect(page.getByRole('button', { name: 'Place order', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.reload();
  await expect(page.locator('.greeting')).toHaveText('Hi, Alex');
  await expect(page.getByRole('button', { name: 'Open cart, 1 items', exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.adobeDataLayer.length)).toBe(1);
  await page.getByRole('button', { name: 'Open cart, 1 items', exact: true }).click();
  await page.getByRole('button', { name: 'Place order', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Thank you, Alex!' })).toBeVisible();
  await expect(page.locator('.order-receipt')).toContainText('349');
  await expect.poll(() => page.evaluate(() => window.adobeDataLayer.filter((e) => e.event === 'purchase').length)).toBe(1);
  const purchase = await page.evaluate(() => window.adobeDataLayer.find((e) => e.event === 'purchase')!);
  expect(purchase).toMatchObject({
    source: 'feastly-website',
    event: 'purchase',
    order: { orderTotal: 349, currency: 'INR' },
    products: [{ productId: 'FST-001', productName: 'The Green Goddess', quantity: 1, unitPrice: 349, totalPrice: 349 }],
  });
  await expect(page.getByRole('dialog')).not.toContainText(/event|JSON|data layer|XDM/i);
  await expect(page.getByRole('button', { name: /Event explorer|See the purchase event|Copy JSON/i })).toHaveCount(0);
  await page.getByRole('button', { name: 'Shop more', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Meet your new favorites.' })).toBeInViewport();
  await expect(page.getByRole('button', { name: 'Open cart, 0 items', exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.adobeDataLayer.filter((e) => e.event === 'purchase').length)).toBe(1);
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open cart, 0 items', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('queues exactly the five event categories with correct removal deltas and no modal pageviews', async ({ page }) => {
  const consolePayloads: Promise<unknown>[] = [];
  page.on('console', (message) => {
    if (message.type() === 'log' && message.text().startsWith('[Feastly data layer] ')) {
      consolePayloads.push(message.args()[1].jsonValue());
    }
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Add The Seoul Bowl to cart', exact: true }).click();
  await page.getByRole('button', { name: 'Add The Seoul Bowl to cart', exact: true }).click();
  await page.getByRole('button', { name: 'Open cart, 2 items', exact: true }).click();
  await page.getByRole('button', { name: 'Remove one The Seoul Bowl', exact: true }).click();
  await page.getByRole('button', { name: 'Sign in to checkout', exact: true }).click();
  await page.getByLabel('First name', { exact: true }).fill('Sam');
  await page.getByLabel('Email address', { exact: true }).fill('sam@example.com');
  await page.getByRole('button', { name: "Let's dig in", exact: true }).click();
  await page.getByRole('button', { name: 'Place order', exact: true }).click();
  const events = await page.evaluate(() => window.adobeDataLayer);
  expect(events.map((e) => e.event)).toEqual([
    'page-view', 'add-to-cart', 'add-to-cart', 'remove-from-cart', 'authentication', 'purchase',
  ]);
  const removal = events[3];
  const purchase = events[5];
  if (removal.event !== 'remove-from-cart' || purchase.event !== 'purchase') {
    throw new Error('Expected remove-from-cart and purchase messages.');
  }
  expect(removal.products).toMatchObject([{ productName: 'The Seoul Bowl', quantity: 1, unitPrice: 449, totalPrice: 449 }]);
  expect(purchase.products).toMatchObject([{ productName: 'The Seoul Bowl', quantity: 1, unitPrice: 449, totalPrice: 449 }]);
  expect(purchase.order).toMatchObject({ orderTotal: 449, currency: 'INR' });
  expect(new Set(events.map((event) => event.eventId)).size).toBe(events.length);
  expect(await Promise.all(consolePayloads)).toEqual(events);
  expect(events[0].customer).toEqual({ isSignedIn: false });
  expect(events[4].customer).toEqual({ isSignedIn: true, firstName: 'Sam', email: 'sam@example.com' });
  expect(events[5].customer).toEqual(events[4].customer);
  for (const event of events) {
    expect(event.source).toBe('feastly-website');
    expect(event.eventDescription).toBeTruthy();
    expect(JSON.stringify(event)).not.toMatch(
      /"(?:xdm|eventType|identityMap|_id|commerce|webPageDetails|productListItems|SKU|priceTotal|currencyCode|_feastly)"\s*:/,
    );
  }
  await page.getByRole('button', { name: 'Shop more', exact: true }).click();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  const signOut = await page.evaluate(() => window.adobeDataLayer.at(-1)!);
  expect(signOut).toMatchObject({
    event: 'authentication',
    authentication: { action: 'sign-out' },
    customer: { isSignedIn: false },
  });
  expect(signOut.customer).not.toHaveProperty('email');
  expect(await Promise.all(consolePayloads)).toEqual(await page.evaluate(() => window.adobeDataLayer));
});

test('mobile layout fits, images load, and dialogs support Escape', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  await expect(page.locator('.product-card')).toHaveCount(3);
  await page.locator('.footer').scrollIntoViewIfNeeded();
  await expect.poll(() => page.evaluate(() => [...document.images].every((img) => img.complete && img.naturalWidth > 0))).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.getByRole('button', { name: /Event explorer/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Open cart, 0 items', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('blocked localStorage reports a visible warning while the cart remains usable', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => { throw new DOMException('Storage blocked', 'SecurityError'); };
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Add The Green Goddess to cart', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Browser storage is unavailable');
  await expect(page.getByRole('button', { name: 'Open cart, 1 items', exact: true })).toBeVisible();
});

test('invalid sign-in input stays in the form without changing identity or tracking', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByLabel('First name', { exact: true }).fill('Alex');
  await page.getByLabel('Email address', { exact: true }).fill('alex@demo');
  await page.getByRole('button', { name: "Let's dig in", exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(await page.getByLabel('Email address', { exact: true }).evaluate((element) => (element as HTMLInputElement).validity.patternMismatch)).toBe(true);
  await page.getByLabel('Email address', { exact: true }).fill('alex@example.com');
  await page.getByLabel('First name', { exact: true }).fill('   ');
  await page.getByRole('button', { name: "Let's dig in", exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(await page.evaluate(() => window.adobeDataLayer.filter((event) => event.event === 'authentication').length)).toBe(0);
  await page.getByLabel('First name', { exact: true }).fill('Alex');
  await page.getByRole('button', { name: "Let's dig in", exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.greeting')).toHaveText('Hi, Alex');
});
