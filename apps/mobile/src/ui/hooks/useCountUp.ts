/**
 * useCountUp — contador animado del BalanceCard (BP-03, tarea 4.2).
 * Ease-out cúbico sobre csMotion-equivalent (280 ms) con Animated nativo de RN
 * (sin dependencias extra): el valor interpola entre el balance anterior y el
 * nuevo. Si el sistema pide «reducir movimiento» se salta directo al final.
 * El último frame siempre se fija al objetivo (sin drift por parada).
 */
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing } from 'react-native';
import { csMotion } from '@monedero/tokens';

export function useCountUp(target: number, reducedMotion: boolean): number {
  const [display, setDisplay] = useState(target);
  const displayRef = useRef(target);

  useEffect(() => {
    if (reducedMotion || displayRef.current === target) {
      displayRef.current = target;
      setDisplay(target);
      return;
    }

    const value = new Animated.Value(displayRef.current);
    const id = value.addListener(({ value: v }) => {
      const next = Math.round(v);
      displayRef.current = next;
      setDisplay(next);
    });
    const anim = Animated.timing(value, {
      toValue: target,
      duration: csMotion.slow,
      easing: Easing.bezier(...csMotion.easeOut),
      useNativeDriver: false,
    });
    anim.start(({ finished }) => {
      value.removeListener(id);
      if (finished) {
        displayRef.current = target;
        setDisplay(target);
      }
    });

    return () => {
      anim.stop();
      value.removeListener(id);
    };
  }, [target, reducedMotion]);

  return display;
}
