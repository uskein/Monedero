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
