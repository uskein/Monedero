// Setup global de Vitest (jsdom) — mocks mínimos de APIs de navegador no implementadas.
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// jsdom no implementa matchMedia: simulamos preferencias estándar.
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
