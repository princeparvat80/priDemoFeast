export const products = [
  {
    id: 'FST-001',
    name: 'The Green Goddess',
    subtitle: 'A little green. A lot of goodness.',
    description: 'Roasted chickpeas, crisp greens, avocado & quinoa, finished with a lemon-tahini drizzle.',
    price: 349,
    category: 'Bowl',
    cuisine: 'Mediterranean',
    veg: true,
    spiceLevel: 'Mild',
    tag: 'PLANT-POWERED',
    image: '/images/green-bowl.jpg',
    imageAlt: 'Fresh bowl of greens, vegetables, and nourishing grains',
    color: 'sage',
    calories: 420,
  },
  {
    id: 'FST-002',
    name: 'The Comfort Classic',
    subtitle: 'Your happy place, in a bowl.',
    description: 'Creamy butter paneer, fragrant basmati rice & warm spices. A hug with every bite.',
    price: 399,
    category: 'Bowl',
    cuisine: 'Indian',
    veg: true,
    spiceLevel: 'Medium',
    tag: 'CROWD FAVORITE',
    image: '/images/paneer-bowl.jpg',
    imageAlt: 'Rich Indian curry with rice and fresh herbs',
    color: 'peach',
    calories: 580,
  },
  {
    id: 'FST-003',
    name: 'The Seoul Bowl',
    subtitle: 'Big flavor. Just the right kick.',
    description: 'Gochujang chicken, sesame rice, crunchy slaw & pickled veggies. Sweet meets heat.',
    price: 449,
    category: 'Bowl',
    cuisine: 'Korean',
    veg: false,
    spiceLevel: 'Hot',
    tag: 'A LITTLE ADVENTURE',
    image: '/images/seoul-bowl.jpg',
    imageAlt: 'Korean-style bowl with colorful vegetables, rice, and glazed chicken',
    color: 'lilac',
    calories: 510,
  },
] as const;

export type Product = (typeof products)[number];
export type ProductId = Product['id'];
export type CartItem = { productId: ProductId; quantity: number };
export type User = { firstName: string; email: string };
export type Order = { id: string; items: CartItem[]; total: number; createdAt: string };

export function getProduct(id: ProductId): Product {
  const product = products.find((item) => item.id === id);
  if (!product) throw new Error(`Unknown product: ${id}`);
  return product;
}

export function totalFor(items: CartItem[]) {
  return items.reduce((sum, item) => sum + getProduct(item.productId).price * item.quantity, 0);
}

export const money = (value: number) => new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', maximumFractionDigits: 0,
}).format(value);
