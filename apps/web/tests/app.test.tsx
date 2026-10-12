import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../src/app/App';

describe('App (smoke S1)', () => {
  it('renderiza el wordmark Monedero', () => {
    render(<App />);
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1.textContent).toContain('Monedero');
  });

  it('anuncia el mensaje de privacidad con role=status (a11y)', () => {
    render(<App />);
    const status = screen.getByRole('status');
    expect(status.textContent).toContain('Tus datos nunca salen de tu dispositivo');
  });

  it('maqueta el hero con estilo inline derivado de tokens', () => {
    render(<App />);
    const main = screen.getByRole('main');
    expect(main.style.backgroundColor).toBe('rgb(244, 239, 231)'); // #F4EFE7 = --cs-bg-base
  });
});
