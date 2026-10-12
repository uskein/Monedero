/**
 * Design System móvil «Clay Serenity» — subset inicial (Paso 3).
 * RN no usa CSS vars: consume tokens TS de @monedero/tokens (misma SSOT).
 * Fuente: manual-identidad-visual.md §7 · Primitivas: Button, Card, Input.
 */
import { Button } from './Button';
import { Card } from './Card';
import { Input } from './Input';

export { Button, Card, Input };
export type { ButtonProps, ButtonVariant } from './Button';
export type { CardProps } from './Card';
export type { InputProps } from './Input';
