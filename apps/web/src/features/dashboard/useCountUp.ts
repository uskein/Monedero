/**
 * useCountUp — contador animado del BalanceCard (BP-03, blueprint:
 * «Contador animado (COP $ 12.480.550)»). Interpola desde el valor anterior
 * hasta el nuevo en CS_MOTION.duration con easing suave; con
 * prefers-reduced-motion (WCAG 2.1 AA) salta directo al valor final.
 * El valor FINAL va siempre en el aria-label del contenedor: los lectores de
 * pantalla nunca escuchan valores intermedios.
 */
import { useEffect, useRef, useState } from 'react';
import { csMotion } from '@monedero/tokens';

/** Duración del conteo (ms) — token SSOT; «¿cuánto queda?» en <3 s (blueprint). */
const COUNT_MS = csMotion.slow;

export function useCountUp(target: number, reducedMotion: boolean): number {
  const [display, setDisplay] = useState(target);
  const fromRef = useRef(target);

  useEffect(() => {
    if (reducedMotion || fromRef.current === target) {
      fromRef.current = target;
      setDisplay(target);
      return;
    }
    const from = fromRef.current;
    const start = performance.now();
    let raf = 0;
    // Sin el timestamp de rAF: en algunos entornos de test (jsdom) su reloj
    // tiene otro origen que performance.now() y el progreso saldría negativo.
    const tick = (): void => {
      const p = Math.min(1, (performance.now() - start) / COUNT_MS);
      const eased = 1 - (1 - p) ** 3; // ease-out cúbico
      const value = Math.round(from + (target - from) * eased);
      setDisplay(value);
      if (p < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, reducedMotion]);

  return display;
}
