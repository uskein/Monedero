/**
 * i18n tests — traducción, interpolación, fallback y formatMoney (HU-18).
 * ESTANDAR_INTERNACIONALIZACION.md §5.
 */
import { describe, it, expect } from 'vitest';
import { createTranslator, detectLocale, DICTIONARIES, esCO, enUS } from '../src/translator';
import { formatMoney, formatMoneySigned, parseAmountToCents, decimalsFor, symbolFor } from '../src/format';

describe('createTranslator', () => {
  const t = createTranslator('es-CO');

  it('traduce claves en es-CO', () => {
    expect(t('vault.lock.title')).toBe('Bóveda bloqueada');
  });

  it('traduce claves en en-US', () => {
    expect(createTranslator('en-US')('vault.lock.title')).toBe('Vault locked');
  });

  it('interpola parámetros {var}', () => {
    expect(t('vault.onboarding.step', { current: 2, total: 4 })).toBe('2 de 4');
    expect(createTranslator('en-US')('vault.onboarding.step', { current: 1, total: 4 })).toBe('1 of 4');
  });

  it('no altera plantillas sin parámetros', () => {
    expect(t('common.loading')).toBe('Cargando…');
  });

  it('locale desconocido cae a es-CO', () => {
    expect(DICTIONARIES['fr-FR' as never]).toBeUndefined();
    const fallback = createTranslator('fr-FR' as never);
    expect(fallback('app.name')).toBe('Monedero');
  });
});

describe('detectLocale', () => {
  it('detecta inglés', () => {
    expect(detectLocale(['en-GB'])).toBe('en-US');
    expect(detectLocale(['en'])).toBe('en-US');
  });
  it('detecta español (default del proyecto)', () => {
    expect(detectLocale(['es-MX'])).toBe('es-CO');
    expect(detectLocale(['es'])).toBe('es-CO');
  });
  it('sin datos → es-CO (mercado objetivo)', () => {
    expect(detectLocale([])).toBe('es-CO');
    expect(detectLocale(undefined)).toBe('es-CO');
  });
});

describe('Paridad de diccionarios (gate CI)', () => {
  it('en-US tiene exactamente las mismas claves que es-CO', () => {
    const master = Object.keys(esCO).sort();
    const translated = Object.keys(enUS).sort();
    expect(translated).toEqual(master);
  });

  it('ninguna traducción está vacía', () => {
    for (const [key, value] of Object.entries(enUS)) {
      expect(value, `clave vacía: ${key}`).not.toBe('');
    }
    for (const [key, value] of Object.entries(esCO)) {
      expect(value, `clave vacía: ${key}`).not.toBe('');
    }
  });
});

describe('formatMoney (HU-18: formateo regional, sin conversión)', () => {
  it('COP tiene 0 decimales; USD/EUR tienen 2', () => {
    expect(decimalsFor('COP')).toBe(0);
    expect(decimalsFor('USD')).toBe(2);
    expect(decimalsFor('EUR')).toBe(2);
  });

  it('símbolos: $ / US$ / €', () => {
    expect(symbolFor('COP')).toBe('$');
    expect(symbolFor('USD')).toBe('US$');
    expect(symbolFor('EUR')).toBe('€');
  });

  it('COP en es-CO: miles con punto, sin decimales', () => {
    const text = formatMoney(1850000, 'COP', 'es-CO'); // 18.500 COP
    expect(text).toContain('18.500');
    expect(text).not.toContain(',00');
  });

  it('USD en es-CO: coma decimal, 2 decimales', () => {
    const text = formatMoney(185050, 'USD', 'es-CO'); // 1850.50
    expect(text).toContain('1.850,50');
  });

  it('USD en en-US: coma de miles, punto decimal', () => {
    const text = formatMoney(185050, 'USD', 'en-US');
    expect(text).toContain('1,850.50');
  });

  it('formato de signo para filas: + ingreso / − gasto', () => {
    expect(formatMoneySigned(450000, 'COP', 'es-CO', false)).toMatch(/^−/);
    expect(formatMoneySigned(32000000, 'COP', 'es-CO', true)).toMatch(/^\+/);
  });

  it('negativos se formatean con signo menos regional', () => {
    const text = formatMoney(-450000, 'COP', 'es-CO');
    expect(text).toContain('4.500');
    expect(text.startsWith('-') || text.startsWith('−')).toBe(true);
  });
});

describe('parseAmountToCents — entrada a centavos enteros (regla única PWA/móvil)', () => {
  it('sin separador: unidades enteras → ×100', () => {
    expect(parseAmountToCents('25000')).toBe(2500000);
  });

  it('miles es-CO "18.500" (3 dígitos tras el punto) → 1 850 000', () => {
    expect(parseAmountToCents('18.500')).toBe(1850000);
  });

  it('miles+decimal es "18.500,50" → 1 850 050', () => {
    expect(parseAmountToCents('18.500,50')).toBe(1850050);
  });

  it('miles+decimal en "18,500.50" → 1 850 050', () => {
    expect(parseAmountToCents('18,500.50')).toBe(1850050);
  });

  it('decimal corto "12.5" (1 dígito) → 1250', () => {
    expect(parseAmountToCents('12.5')).toBe(1250);
  });

  it('decimal es-CO "12,5" → 1250', () => {
    expect(parseAmountToCents('12,5')).toBe(1250);
  });

  it('decimal de 2 dígitos "99.99" → 9999 (entero, sin flotantes)', () => {
    const cents = parseAmountToCents('99.99');
    expect(cents).toBe(9999);
    expect(Number.isInteger(cents)).toBe(true);
  });

  it('"0" → 0 (el schema de dominio lo rechaza, el parseo es neutro)', () => {
    expect(parseAmountToCents('0')).toBe(0);
  });

  it('vacío → null', () => {
    expect(parseAmountToCents('')).toBeNull();
  });

  it('texto no numérico → null', () => {
    expect(parseAmountToCents('abc')).toBeNull();
  });

  it('ignora espacios de agrupado', () => {
    expect(parseAmountToCents('18 500')).toBe(1850000);
  });
});
