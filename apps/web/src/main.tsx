import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './app/App';
import '@monedero/tokens/tokens.css';
import './design-system/base.css';

const container = document.getElementById('root');
if (!container) throw new Error('ROOT_NOT_FOUND');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Offline-first (S8): solo en build de producción; en dev HMR no lo necesita.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err: unknown) => {
      // Sin SW la app sigue funcionando online: nunca romper el arranque.
      console.warn('[monedero] service worker no registrado', err);
    });
  });
}
