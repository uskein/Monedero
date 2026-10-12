/**
 * usePrefersReducedMotion — lee la preferencia del SO «reducir movimiento».
 * Requerimiento WCAG 2.1 AA (2.3.3) y regla del Manifiesto de Calidad: los
 * contadores/transiciones animados deben respetarla. Compartido por App
 * (transiciones de bóveda) y DashboardScreen (contador de balance).
 */
import { useSyncExternalStore } from 'react';

export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
      mq.addEventListener('change', cb);
      return () => mq.removeEventListener('change', cb);
    },
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
}
