import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../src/app/App';

describe('App (smoke S1)', () => {
  it('renderiza el wordmark Monedero', () => {
    render(<App />);
    // Hero h1 «Monedero» + h1 del onboarding: buscar por texto exacto del wordmark
    const headings = screen.getAllByRole('heading', { level: 1 });
    expect(headings.some((h) => h.textContent === 'Monedero')).toBe(true);
  });

  it('anuncia el mensaje de privacidad con role=status (a11y)', () => {
    render(<App />);
    const statuses = screen.getAllByRole('status');
    expect(
      statuses.some((el) => el.textContent?.includes('nunca salen de tu dispositivo')),
    ).toBe(true);
  });

  it('maqueta el hero con estilo inline derivado de tokens', () => {
    render(<App />);
    const main = screen.getByRole('main');
    expect(main.style.backgroundColor).toBe('rgb(244, 239, 231)'); // #F4EFE7 = --cs-bg-base
  });
});
