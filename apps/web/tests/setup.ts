// Setup global de Vitest (jsdom) — mocks mínimos de APIs de navegador no implementadas.
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// jsdom no implementa matchMedia: simulamos preferencias estándar.
// jsdom reporta navigator.languages = ['en-US']: el mercado objetivo es es-CO,
// así que el entorno de test arranca en español (ESTANDAR_INTERNACIONALIZACION §3).
Object.defineProperty(window.navigator, 'languages', {
  get: () => ['es-CO', 'es'],
  configurable: true,
});

if (!window.matchMedia) {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;
}

afterEach(() => {
  cleanup();
});
