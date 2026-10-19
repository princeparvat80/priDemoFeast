import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  ArrowDown, ArrowRight, Check, CheckCheck, Clock3,
  Leaf, LogOut, Minus, Plus, ShoppingBag, Soup, Sparkles, Sprout,
  Truck, UserRound, X,
} from 'lucide-react';
import { actions, type AppDispatch, type RootState } from './store';
import { getProduct, money, products, totalFor } from './catalog';
import { track } from './analytics';

type Panel = 'cart' | 'auth' | 'order' | null;

function Modal({ title, children, onClose, className = '' }: {
  title: string; children: ReactNode; onClose: () => void; className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const dialog = ref.current!;
    const previous = document.activeElement;
    dialog.showModal();
    const cancel = (event: Event) => { event.preventDefault(); closeRef.current(); };
    dialog.addEventListener('cancel', cancel);
    return () => {
      dialog.removeEventListener('cancel', cancel);
      dialog.close();
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, []);
  return (
    <dialog ref={ref} className={`modal ${className}`} aria-labelledby="modal-title"
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="modal-content">
        <div className="modal-heading">
          <h2 id="modal-title">{title}</h2>
          <button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={21} /></button>
        </div>
        {children}
      </div>
    </dialog>
  );
}

export default function App() {
  const dispatch = useDispatch<AppDispatch>();
  const { cart, user, lastOrder, persistenceError } = useSelector((state: RootState) => state.shop);
  const [panel, setPanel] = useState<Panel>(null);
  const [checkoutIntent, setCheckoutIntent] = useState(false);
  const [toast, setToast] = useState('');
  const pageTracked = useRef(false);
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const total = totalFor(cart);

  useEffect(() => {
    if (!pageTracked.current) {
      track('page-view', user);
      pageTracked.current = true;
    }
  }, [user]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const firstName = String(data.get('firstName')).trim();
    const email = String(data.get('email')).trim().toLowerCase();
    if (!firstName) {
      const input = event.currentTarget.elements.namedItem('firstName') as HTMLInputElement;
      input.setCustomValidity('Please enter your first name.');
      input.reportValidity();
      return;
    }
    dispatch(actions.signedIn({ firstName, email }));
    setPanel(checkoutIntent ? 'cart' : null);
    setCheckoutIntent(false);
    setToast(`You're in, ${firstName}. Make yourself at home.`);
  }

  function checkout() {
    if (!cart.length) return;
    if (!user) {
      setCheckoutIntent(true);
      setPanel('auth');
      return;
    }
    dispatch(actions.purchased());
    setPanel('order');
  }

  return (
    <div className="site-shell">
      <div className="announcement"><Sprout size={14} /><span>Freshly made. Thoughtfully sourced. Happily delivered.</span><Sprout size={14} /></div>
      <header className="header">
        <a className="brand" href="#" aria-label="Feastly home" onClick={(event) => {
          event.preventDefault(); setPanel(null); window.scrollTo({ top: 0, behavior: 'smooth' });
        }}><span className="brand-icon"><Soup size={23} strokeWidth={1.8} /></span>feastly<span className="brand-period">.</span></a>
        <nav aria-label="Main navigation">
          <a className="menu-link" href="#menu">Our menu</a>
          <span className="nav-divider" />
          {user ? (
            <div className="account">
              <span className="greeting"><UserRound size={16} />Hi, {user.firstName}</span>
              <button className="sign-button" onClick={() => {
                dispatch(actions.signedOut()); setToast('Signed out. Your bowls are still in your bag.');
              }}><LogOut size={16} /><span>Sign out</span></button>
            </div>
          ) : (
            <button className="sign-button" onClick={() => { setCheckoutIntent(false); setPanel('auth'); }}>
              <UserRound size={17} /><span>Sign in</span>
            </button>
          )}
          <button className="bag-button" onClick={() => setPanel('cart')} aria-label={`Open cart, ${itemCount} items`}>
            <ShoppingBag size={18} /><span>Cart</span><span className="bag-count">{itemCount}</span>
          </button>
        </nav>
      </header>

      {persistenceError && <div className="error-banner" role="alert">{persistenceError}</div>}

      <main>
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <div className="eyebrow"><span /> GOOD FOOD, NO FUSS</div>
            <h1 id="hero-title">Good food.<br />Even better <span className="mood">moods<svg viewBox="0 0 320 18" aria-hidden="true"><path d="M5 12Q150-2 312 9M30 17Q160 6 280 14" /></svg></span>.</h1>
            <p>Real ingredients. Big-hearted flavors.<br />Three feel-good bowls, made to make your day.</p>
            <a className="primary-button hero-cta" href="#menu">Find your happy bowl <ArrowDown size={18} /></a>
            <div className="hero-proof">
              <div className="mini-avatars" aria-hidden="true"><span>J</span><span>A</span><span>M</span><span>R</span></div>
              <div><div className="stars" aria-label="Five stars">★★★★★</div><span>A little bowl of happiness.</span></div>
            </div>
          </div>
          <div className="hero-visual">
            <div className="hero-orbit orbit-one" /><div className="hero-orbit orbit-two" />
            <svg className="hero-spark" viewBox="0 0 60 60" aria-hidden="true"><path d="m30 3 4 19 17-10-11 17 17 6-20 3 2 18-10-16-15 13 7-20-18-3 19-6Z" /></svg>
            <div className="hero-photo"><img src="/images/green-bowl.jpg" alt="A vibrant, freshly prepared vegetable bowl" fetchPriority="high" /></div>
            <div className="floating-label label-fresh"><span className="label-icon"><Leaf size={19} /></span><span>Nothing but the good stuff<small>Fresh. Colorful. Feel-good.</small></span></div>
            <div className="floating-label label-love"><span>Made with<br /><strong>a whole lot of love.</strong></span><span className="hand-heart" aria-hidden="true">♡</span></div>
            <span className="hero-caption">YOUR DAILY DOSE OF DELICIOUS</span>
          </div>
        </section>

        <div className="benefits" aria-label="Our promise">
          <span><Leaf size={18} /> Real, fresh ingredients</span><span className="benefit-dot">·</span>
          <span><Soup size={19} /> Made fresh for you</span><span className="benefit-dot">·</span>
          <span><Truck size={19} /> A little joy, delivered</span><span className="benefit-dot">·</span>
          <span><CheckCheck size={19} /> Simple. Honest. Delicious.</span>
        </div>

        <section id="menu" className="menu-section" aria-labelledby="menu-title">
          <div className="section-heading">
            <div><div className="eyebrow">SMALL MENU. BIG FEELINGS.</div><h2 id="menu-title">Meet your new favorites<span>.</span></h2></div>
            <p>Just three bowls. Each one a good choice.</p>
          </div>
          <div className="product-grid">
            {products.map((product, index) => {
              const quantity = cart.find((item) => item.productId === product.id)?.quantity ?? 0;
              return (
                <article className={`product-card ${product.color}`} key={product.id}>
                  <div className="product-image">
                    <img src={product.image} alt={product.imageAlt} loading="lazy" />
                    <span className="product-tag">{index === 0 ? <Leaf size={12} /> : <Sparkles size={12} />}{product.tag}</span>
                    <span className={`diet-symbol ${product.veg ? '' : 'nonveg'}`} title={product.veg ? 'Vegetarian' : 'Non-vegetarian'} aria-label={product.veg ? 'Vegetarian' : 'Non-vegetarian'}><i /></span>
                  </div>
                  <div className="product-details">
                    <div className="product-meta"><span>{product.cuisine}</span><span className="meta-dot">·</span><span>{product.spiceLevel} spice</span></div>
                    <h3>{product.name}</h3>
                    <p>{product.description}</p>
                    <div className="product-extra"><span><Clock3 size={13} /> Made to order</span><span>{product.calories} kcal</span></div>
                    <div className="product-bottom">
                      <div className="price">{money(product.price)}<small>per bowl</small></div>
                      <button className={`add-button ${quantity ? 'has-items' : ''}`} disabled={quantity >= 20}
                        aria-label={`Add ${product.name} to cart`}
                        onClick={() => { dispatch(actions.added(product.id)); setToast(`${product.name} added to your cart.`); }}>
                        {quantity >= 20 ? 'Limit reached' : <>{quantity > 0 ? `Add another (${quantity})` : 'Add to cart'}<Plus size={16} /></>}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
          <div className="menu-note"><Sprout size={16} /><p>A little something for every craving. Always made with care.</p></div>
        </section>

        <section className="goodness-note">
          <span className="goodness-icon"><Soup size={32} strokeWidth={1.4} /></span>
          <div><h2>Less choosing. More enjoying.</h2><p>We keep things simple, so you can focus on the good part.</p></div>
          <span className="goodness-script">Dig in & feel good. <span aria-hidden="true">♡</span></span>
        </section>
      </main>

      <footer className="footer">
        <div className="footer-top"><a className="brand footer-brand" href="#">feastly<span className="brand-period">.</span></a>
          <span>Good food. Good mood. That simple.</span>
        </div>
        <div className="footer-bottom"><span>© {new Date().getFullYear()} Feastly. Made for a little everyday joy.</span><span>LEARNING DEMO <span>·</span> No real payments or deliveries</span></div>
      </footer>

      <div className={`toast ${toast ? 'visible' : ''}`} role="status" aria-live="polite">
        {toast && <><span className="toast-check"><Check size={15} /></span>{toast}</>}
      </div>

      {panel === 'cart' && <Modal title={`Your happy little cart${itemCount ? ` (${itemCount})` : ''}`} className="cart-modal" onClose={() => setPanel(null)}>
        {!cart.length ? <div className="empty-state"><span className="empty-icon"><ShoppingBag size={38} strokeWidth={1.3} /></span>
          <h3>A good mood starts with a bowl.</h3><p>Your cart is waiting for something delicious.</p>
          <button className="primary-button" onClick={() => setPanel(null)}>Explore the menu <ArrowRight size={17} /></button>
        </div> : <>
          <p className="modal-intro">Excellent choices. Your next good meal is right here.</p>
          <div className="cart-items">{cart.map((item) => {
            const product = getProduct(item.productId);
            return <div className="cart-item" key={item.productId}>
              <img src={product.image} alt={product.imageAlt} />
              <div className="cart-item-info"><h3>{product.name}</h3><p>{product.cuisine} · {money(product.price)}</p>
                <div className="quantity-control">
                  <button aria-label={`Remove one ${product.name}`} onClick={() => dispatch(actions.removed(item.productId))}><Minus size={14} /></button>
                  <span aria-label={`Quantity ${item.quantity}`}>{item.quantity}</span>
                  <button aria-label={`Add one ${product.name}`} disabled={item.quantity >= 20} onClick={() => dispatch(actions.added(item.productId))}><Plus size={14} /></button>
                </div>
              </div><strong>{money(product.price * item.quantity)}</strong>
            </div>;
          })}</div>
          <div className="cart-summary"><div><span>Subtotal</span><span>{money(total)}</span></div><div><span>Delivery</span><span className="free-label">On us</span></div>
            <div className="total-row"><strong>Total</strong><strong>{money(total)}</strong></div>
          </div>
          {!user && <div className="signin-note"><UserRound size={18} /><span>A quick sign-in, then you're good to go.<small>Your cart stays right here.</small></span></div>}
          <button className="primary-button full-width" onClick={checkout}>{user ? 'Place order' : 'Sign in to checkout'}<ArrowRight size={18} /></button>
          <p className="demo-disclaimer">This is a learning demo. No payment is collected.</p>
          <button className="text-button keep-browsing" onClick={() => setPanel(null)}>Keep exploring</button>
        </>}
      </Modal>}

      {panel === 'auth' && <Modal title="Hey, good to see you." className="auth-modal" onClose={() => { setPanel(checkoutIntent ? 'cart' : null); setCheckoutIntent(false); }}>
        <div className="auth-decoration"><Soup size={32} strokeWidth={1.4} /><Sprout size={20} /></div>
        <p className="modal-intro">A name, an email, and you're at the table.</p>
        <form onSubmit={signIn}>
          <label htmlFor="firstName">First name</label>
          <input id="firstName" name="firstName" placeholder="e.g. Alex" autoComplete="given-name" maxLength={40} required
            onInput={(event) => event.currentTarget.setCustomValidity('')} />
          <label htmlFor="email">Email address</label>
          <input id="email" name="email" type="email" placeholder="alex@example.com" autoComplete="email" maxLength={254}
            pattern={"[^\\s@]+@[^\\s@]+\\.[^\\s@]+"} title="Use an email address such as alex@example.com." required />
          <button className="primary-button full-width" type="submit">Let's dig in <ArrowRight size={18} /></button>
        </form>
        <div className="auth-note"><UserRound size={17} /><p><strong>Make yourself at home.</strong>Your profile is saved in this browser. This is a demo store, so please use a made-up email.</p></div>
      </Modal>}

      {panel === 'order' && lastOrder && <Modal title="A bowlful of happiness." className="order-modal" onClose={() => setPanel(null)}>
        <div className="order-success"><Check size={35} /></div>
        <h3>Thank you, {user?.firstName}!</h3>
        <p className="modal-intro">Your order has been placed. A little happiness is on the menu.</p>
        <div className="order-receipt"><div><span>Order number</span><strong>{lastOrder.id}</strong></div>
          {lastOrder.items.map((item) => <div key={item.productId}><span>{item.quantity} × {getProduct(item.productId).name}</span><span>{money(getProduct(item.productId).price * item.quantity)}</span></div>)}
          <div className="total-row"><strong>Order total</strong><strong>{money(lastOrder.total)}</strong></div>
        </div>
        <button className="primary-button full-width" onClick={() => {
          setPanel(null);
          document.getElementById('menu')?.scrollIntoView({ behavior: 'smooth' });
        }}>Shop more <ArrowRight size={17} /></button>
        <p className="demo-disclaimer">Demo store. No payment has been taken and no delivery will be made.</p>
      </Modal>}

    </div>
  );
}
