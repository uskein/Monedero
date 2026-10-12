/**
 * usePrefersReducedMotion (móvil) — espejo del hook homónimo de la PWA.
 * Lee «reducir movimiento» del sistema (AccessibilityInfo) y escucha cambios:
 * el contador del dashboard (BP-03) y otras animaciones deben respetarlo (a11y).
 */
import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let mounted = true;
    // ?. defensivo: entornos de test con mocks parciales de AccessibilityInfo.
    void AccessibilityInfo.isReduceMotionEnabled?.()
      .then((enabled: boolean) => {
        if (mounted) setReduced(enabled);
      })
      .catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  return reduced;
}
