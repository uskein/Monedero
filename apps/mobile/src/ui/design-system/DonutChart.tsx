/**
 * DonutChart (móvil) — donut de reportes BP-07 · HU-13.
 * Paleta SEMÁNTICA de tokens (el caller pasa los colores csColors); rol
 * image + accessibilityLabel (HU-13: role="img" + aria-label) y SIEMPRE se
 * acompaña de la tabla alternativa visible en la pantalla (nunca solo color).
 * Sectores vía strokeDasharray sobre círculos (react-native-svg).
 */
import { View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { csColors } from '@monedero/tokens';

export interface DonutSegment {
  key: string;
  /** 0–100 del total. */
  percent: number;
  /** Valor token (csColors.*). */
  color: string;
}

export interface DonutChartProps {
  segments: DonutSegment[];
  /** Etiqueta a11y del gráfico completo (i18n en caller). */
  label: string;
  size?: number;
  thickness?: number;
}

export function DonutChart({ segments, label, size = 180, thickness = 26 }: DonutChartProps) {
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  // Acumulado de offsets; el resto (hueco) es el segmento "vacío" del track.
  let offsetAcc = 0;
  const visible = segments.filter((s) => s.percent > 0);

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={label}
      style={{ width: size, height: size, alignSelf: 'center' }}
    >
      <Svg width={size} height={size}>
        {/* Pista base (token, nunca literal) */}
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={csColors.surfaceSunken}
          strokeWidth={thickness}
          fill="none"
        />
        <G rotation={-90} origin={`${center}, ${center}`}>
          {visible.map((segment) => {
            const length = (Math.min(segment.percent, 100) / 100) * circumference;
            const dashOffset = -offsetAcc;
            offsetAcc += length;
            return (
              <Circle
                key={segment.key}
                cx={center}
                cy={center}
                r={radius}
                stroke={segment.color}
                strokeWidth={thickness}
                strokeDasharray={`${length} ${circumference - length}`}
                strokeDashoffset={dashOffset}
                strokeLinecap="butt"
                fill="none"
              />
            );
          })}
        </G>
      </Svg>
    </View>
  );
}
