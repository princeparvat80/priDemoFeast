import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { initializeDataLayer } from './analytics';
import { store } from './store';
import App from './App';
import './styles.css';

initializeDataLayer();
createRoot(document.getElementById('root')!).render(
  <Provider store={store}><App /></Provider>,
);

const tagsUrl = import.meta.env.VITE_ADOBE_TAGS_URL?.trim();
if (tagsUrl) {
  const url = new URL(tagsUrl);
  if (url.protocol !== 'https:' || url.hostname !== 'assets.adobedtm.com') {
    throw new Error('VITE_ADOBE_TAGS_URL must be an HTTPS Adobe Tags embed URL on assets.adobedtm.com.');
  }
  const script = document.createElement('script');
  script.src = url.href;
  script.async = true;
  script.onerror = () => {
    console.error('The Adobe Tags library could not be loaded.');
  };
  document.head.append(script);
}
