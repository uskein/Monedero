/**
 * AppErrorBoundary — red de seguridad de render (calidad DoD: nunca pantalla
 * vacía silenciosa). Si cualquier pantalla lanza durante el render, se muestra
 * una tarjeta con role=alert y un reintento que vuelve a montar el árbol.
 * Copy vía t() — cero strings hardcodeados (gate i18n:check).
 */
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useT } from '@monedero/i18n/react';
import { csColors, csSpace } from '@monedero/tokens';
import { Button, Card } from './design-system';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
  /** Key de remontaje: al subir, React descarta el árbol caído. */
  attempt: number;
}

function ErrorFallback({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const t = useT();
  return (
    <View style={styles.wrap} accessibilityLiveRegion="assertive">
      <Card style={styles.card}>
        <Text accessibilityRole="alert" style={styles.title}>
          {t('common.error.generic')}
        </Text>
        {__DEV__ && <Text selectable style={styles.detail}>{error.message}</Text>}
        <Button label={t('common.retry')} onPress={onRetry} />
      </Card>
    </View>
  );
}

export class AppErrorBoundary extends Component<Props, State> {
  override state: State = { error: null, attempt: 0 };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    if (__DEV__) console.warn(`[monedero] render error: ${error.message}`, info.componentStack);
  }

  retry = (): void => {
    this.setState((s) => ({ error: null, attempt: s.attempt + 1 }));
  };

  override render(): ReactNode {
    const { error, attempt } = this.state;
    if (error) return <ErrorFallback error={error} onRetry={this.retry} />;
    return <View key={attempt} style={styles.fill}>{this.props.children}</View>;
  }
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  wrap: { flex: 1, padding: csSpace.s4, justifyContent: 'center' },
  card: { gap: csSpace.s3 },
  title: { fontSize: 16, fontWeight: '700', color: csColors.textPrimary },
  detail: { fontSize: 12, color: csColors.textMuted },
});
