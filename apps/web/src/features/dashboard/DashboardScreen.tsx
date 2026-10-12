/**
 * DashboardScreen — BP-03 «Inicio» (HU-08·09·12).
 * Propósito (blueprint): responder «¿cuánto queda?» en <3 s — balance total con
 * contador animado, periodo (segmented mes actual/anterior), ingreso/gasto del
 * mes y últimos movimientos. 4 estados DoD: loading (skeletons shimmer, sin
 * flash de vacío) · empty (balance + CTA «Añadir primer movimiento») · success
 * (contador + filas .tx) · error (reintento). Copy vía useI18n() (i18n:check).
 * Trazabilidad: BLUEPRINTS_DE_PANTALLAS.md BP-03 · PLAN_DE_SPRINTS 4.2.
 */
import { useEffect, useState } from 'react';
import { useI18n } from '@monedero/i18n/react';
import { formatMonthLabel, monthKeyOf, previousMonthKey, type CurrencyCode } from '@monedero/i18n';
import {
  Button,
  Card,
  EmptyState,
  Segmented,
  Skeleton,
  Toast,
  TxRow,
  usePrefersReducedMotion,
} from '../../design-system';
import { DEFAULT_CATEGORIES } from '../../data/catalog';
import { getTxRepo } from '../../data/db/session';
import { txRowView } from '../transactions/presentTx';
import { useDashboardStore, type DashboardRepo } from './store';
import { useCountUp } from './useCountUp';

export interface DashboardScreenProps {
  currency: CurrencyCode;
  /** Solo tests: repo en memoria para no tocar sql.js en la UI. */
  repoOverride?: DashboardRepo;
  /** CTA «Añadir primer movimiento» → navega al alta (BP-05). */
  onAddFirst?: () => void;
  /** «Movimientos» → navega a la lista (BP-04). */
  onSeeAll?: () => void;
}

export function DashboardScreen({ currency, repoOverride, onAddFirst, onSeeAll }: DashboardScreenProps) {
  const { t, locale, money, moneySigned } = useI18n();
  const status = useDashboardStore((s) => s.status);
  const month = useDashboardStore((s) => s.month);
  const summary = useDashboardStore((s) => s.summary);
  const latest = useDashboardStore((s) => s.latest);
  const init = useDashboardStore((s) => s.init);
  const setMonth = useDashboardStore((s) => s.setMonth);
  const refresh = useDashboardStore((s) => s.refresh);
  const reducedMotion = usePrefersReducedMotion();
  const [bootError, setBootError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      try {
        // Sesión compartida: el MISMO repo que usa la lista → eventos 'tx' (4.3).
        const repo = repoOverride ?? (await getTxRepo());
        if (!cancelled) await init(repo);
      } catch {
        if (!cancelled) setBootError(true);
      }
    }
    void boot();
    return () => {
      cancelled = true;
    };
  }, [init, repoOverride]);

  const currentMonth = monthKeyOf(new Date());
  const total = summary?.totalBalanceCents ?? 0;
  const monthBalance = summary?.monthBalanceCents ?? 0;
  const displayCents = useCountUp(total, reducedMotion);

  const categoryNames: Record<string, string> = Object.fromEntries(
    DEFAULT_CATEGORIES.map((c) => [c.id, c.name]),
  );

  // ── Error (STORAGE_UNAVAILABLE → reintento, blueprint BP-03) ──
  if (bootError || status === 'error') {
    return (
      <section aria-label={t('home.title')} style={{ display: 'grid', gap: 'var(--cs-space-4)' }}>
        <div style={{ display: 'grid', gap: 'var(--cs-space-4)', justifyItems: 'start' }}>
          <Toast tone="error">{t('home.error')}</Toast>
          <Button
            variant="secondary"
            onClick={() => (bootError ? window.location.reload() : void refresh())}
          >
            {t('common.retry')}
          </Button>
        </div>
      </section>
    );
  }

  // ── Loading (skeletons shimmer, sin flash de vacío) ──
  if (status === 'loading') {
    return (
      <section
        aria-label={t('home.title')}
        aria-busy="true"
        aria-live="polite"
        style={{ display: 'grid', gap: 'var(--cs-space-4)' }}
      >
        <Card>
          <Skeleton width="40%" />
          <div style={{ height: 'var(--cs-space-3)' }} />
          <Skeleton width="70%" height={36} />
        </Card>
        <Skeleton height={96} />
        <Skeleton height={140} />
      </section>
    );
  }

  const balancePeriodRow = (
    <span style={{ color: 'var(--cs-text-muted)', fontSize: 14 }}>
      {t('home.month.balance')}: {moneySigned(monthBalance, currency, monthBalance >= 0)}
    </span>
  );

  // ── Success / Empty ──
  return (
    <section aria-label={t('home.title')} style={{ display: 'grid', gap: 'var(--cs-space-5)' }}>
      {/* .card balance — contador animado (estado success) / $ 0 (estado empty) */}
      <Card>
        <div style={{ display: 'grid', gap: 'var(--cs-space-2)' }}>
          <span style={{ color: 'var(--cs-text-muted)', fontSize: 14 }}>{t('home.balance')}</span>
          {/* El texto cambia sin live region: los lectores leen el valor final al navegar. */}
          <span
            style={{
              fontFamily: 'var(--cs-font-display)',
              fontSize: 34,
              fontWeight: 700,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {money(displayCents, currency)}
          </span>
          {balancePeriodRow}
        </div>
        <div style={{ marginTop: 'var(--cs-space-4)' }}>
          <Segmented
            label={t('home.period')}
            options={[
              { value: currentMonth, label: t('home.period.current') },
              { value: previousMonthKey(currentMonth), label: t('home.period.previous') },
            ]}
            value={month}
            onChange={(next) => void setMonth(next)}
          />
        </div>
      </Card>

      {status === 'empty' ? (
        <EmptyState
          icon="🌱"
          title={t('tx.list.empty.title')}
          copy={t('tx.list.empty.copy')}
          action={
            onAddFirst ? (
              <Button variant="primary" onClick={onAddFirst}>
                {t('tx.list.empty.cta')}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          {/* Informe del periodo (.segmented + filas) */}
          <Card>
            <h2
              style={{
                fontFamily: 'var(--cs-font-display)',
                fontSize: 22,
                fontWeight: 600,
                margin: '0 0 var(--cs-space-3)',
              }}
            >
              {formatMonthLabel(month, locale)}
            </h2>
            <dl style={{ margin: 0, display: 'grid', gap: 'var(--cs-space-2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--cs-space-3)' }}>
                <dt style={{ color: 'var(--cs-text-muted)' }}>{t('home.month.income')}</dt>
                <dd style={{ margin: 0, fontVariantNumeric: 'tabular-nums' }}>
                  {moneySigned(summary?.incomeCents ?? 0, currency, true)}
                </dd>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--cs-space-3)' }}>
                <dt style={{ color: 'var(--cs-text-muted)' }}>{t('home.month.expense')}</dt>
                <dd style={{ margin: 0, fontVariantNumeric: 'tabular-nums' }}>
                  {moneySigned(summary?.expenseCents ?? 0, currency, false)}
                </dd>
              </div>
            </dl>
          </Card>

          {/* Últimos movimientos (.tx) */}
          <div style={{ display: 'grid', gap: 'var(--cs-space-3)' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 'var(--cs-space-3)' }}>
              <h2
                style={{
                  fontFamily: 'var(--cs-font-display)',
                  fontSize: 22,
                  fontWeight: 600,
                  margin: 0,
                }}
              >
                {t('home.latest')}
              </h2>
              {onSeeAll ? (
                <Button variant="ghost" onClick={onSeeAll}>
                  {t('tx.list.title')}
                </Button>
              ) : null}
            </div>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 'var(--cs-space-2)' }}>
              {latest.map((tx) => (
                <li key={tx.id}>
                  <TxRow {...txRowView(tx, { t, currency, moneySigned, categoryNames })} />
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </section>
  );
}
