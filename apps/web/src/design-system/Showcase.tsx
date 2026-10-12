/**
 * COMPONENTS_SHOWCASE — galería viva del Design System (Paso 3 Orquestador).
 * Acceso en dev: http://localhost:5173/design-system
 * NOTA: el copy de esta página es de DEMOSTRACIÓN interna (exento de i18n como
 * artefacto de desarrollo, ESTANDAR_INTERNACIONALIZACION.md §4.3); los componentes
 * reales reciben todo su texto por props i18n.
 */
import { useState } from 'react';
import {
  Button,
  Card,
  Chip,
  ChipButton,
  EmptyState,
  Field,
  Input,
  Modal,
  MoneyInput,
  Progress,
  Segmented,
  Skeleton,
  Spinner,
  Toast,
  Toggle,
  TxRow,
} from './index';

const SECTIONS = ['Acciones', 'Formularios', 'Feedback', 'Datos'] as const;
type Section = (typeof SECTIONS)[number];

export default function Showcase() {
  const [section, setSection] = useState<Section>('Acciones');
  const [modalOpen, setModalOpen] = useState(false);
  const [switchOn, setSwitchOn] = useState(true);
  const [amount, setAmount] = useState('18500');
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | undefined>(undefined);
  const [period, setPeriod] = useState<'mes' | 'semana'>('mes');

  const validateEmail = (value: string) => {
    setEmail(value);
    setEmailError(value.length > 0 && !value.includes('@') ? 'Introduce un correo válido' : undefined);
  };

  return (
    <main
      style={{
        maxWidth: 880,
        margin: '0 auto',
        padding: '32px 20px 64px',
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
      }}
    >
      <header style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div
          aria-hidden="true"
          style={{
            width: 48,
            height: 48,
            borderRadius: '27%',
            background: 'var(--cs-primary)',
            color: 'var(--cs-text-on-primary)',
            display: 'grid',
            placeItems: 'center',
            fontFamily: 'var(--cs-font-display)',
            fontWeight: 700,
            fontSize: 28,
          }}
        >
          M
        </div>
        <div>
          <h1 style={{ fontFamily: 'var(--cs-font-display)', fontSize: 26, margin: 0 }}>Design System · Clay Serenity</h1>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--cs-text-muted)' }}>
            Componentes implementados — SSOT manual-identidad-visual.md §7
          </p>
        </div>
      </header>

      <Segmented label="Secciones del showcase" options={SECTIONS.map((s) => ({ value: s, label: s }))} value={section} onChange={setSection} />

      {section === 'Acciones' && (
        <Card>
          <h2 style={{ fontFamily: 'var(--cs-font-display)', fontSize: 20, marginTop: 0 }}>Botones (§7.1)</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
            <Button>Primario</Button>
            <Button variant="secondary">Secundario</Button>
            <Button variant="ghost">Texto peligroso</Button>
            <Button variant="icon" aria-label="Añadir movimiento">
              +
            </Button>
            <Button disabled>Deshabilitado</Button>
          </div>
          <h2 style={{ fontFamily: 'var(--cs-font-display)', fontSize: 20 }}>Toggle (§7.4)</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Toggle label="Modo oscuro" checked={switchOn} onChange={setSwitchOn} />
            <span style={{ fontSize: 14, color: 'var(--cs-text-muted)' }}>{switchOn ? 'Activado' : 'Desactivado'}</span>
          </div>
          <h2 style={{ fontFamily: 'var(--cs-font-display)', fontSize: 20 }}>Segmented (§7.2)</h2>
          <Segmented
            label="Periodo"
            options={[
              { value: 'mes', label: 'Este mes' },
              { value: 'semana', label: 'Semana' },
            ]}
            value={period}
            onChange={setPeriod}
          />
        </Card>
      )}

      {section === 'Formularios' && (
        <Card>
          <h2 style={{ fontFamily: 'var(--cs-font-display)', fontSize: 20, marginTop: 0 }}>Formularios (§7.4)</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <MoneyInput label="Importe" currencySymbol="$" value={amount} onValueChange={setAmount} />
            <Field label="Correo (validación con error)" error={emailError}>
              {({ inputId, describedBy, invalid }) => (
                <Input
                  inputId={inputId}
                  describedBy={describedBy}
                  invalid={invalid}
                  placeholder="tu@correo.com"
                  value={email}
                  onChange={(e) => validateEmail(e.target.value)}
                />
              )}
            </Field>
          </div>
        </Card>
      )}

      {section === 'Feedback' && (
        <Card>
          <h2 style={{ fontFamily: 'var(--cs-font-display)', fontSize: 20, marginTop: 0 }}>Feedback (§7.5)</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Toast tone="success">Movimiento guardado localmente</Toast>
            <Toast tone="warn">Te acercas al límite de Comida</Toast>
            <Toast tone="error">No se pudo importar el fichero</Toast>
            <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
              <Spinner label="Cargando…" />
              <Button onClick={() => setModalOpen(true)}>Abrir modal</Button>
            </div>
            <div>
              <p style={{ fontSize: 13, color: 'var(--cs-text-muted)', margin: '0 0 6px' }}>Presupuesto de Comida — 86%</p>
              <Progress percent={86} label="Presupuesto de Comida al 86 por ciento" />
            </div>
          </div>
        </Card>
      )}

      {section === 'Datos' && (
        <>
          <Card>
            <h2 style={{ fontFamily: 'var(--cs-font-display)', fontSize: 20, marginTop: 0 }}>Filas y chips (§7.5–7.6)</h2>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <Chip tone="income">+ Ingreso</Chip>
              <Chip tone="expense">− Gasto</Chip>
              <Chip tone="pending">Pendiente</Chip>
              <ChipButton tone="pending" aria-pressed="true">
                Filtro: Comida
              </ChipButton>
            </div>
            <TxRow
              icon="☕"
              title="Café de la esquina"
              category="Comida"
              amount="− $ 4.500"
              isIncome={false}
              ariaLabel="Café de la esquina, categoría Comida, gasto de 4.500 pesos colombianos"
            />
            <TxRow
              icon="💼"
              title="Proyecto freelance"
              category="Ingresos"
              amount="+ $ 320.000"
              isIncome
              ariaLabel="Proyecto freelance, categoría Ingresos, ingreso de 320.000 pesos colombianos"
            />
            <Skeleton height={54} />
          </Card>
          <Card>
            <EmptyState
              title="Sin movimientos aún"
              copy="Tu lista está tranquila. Registra tu primer gasto cuando quieras."
              action={<Button>Registrar movimiento</Button>}
            />
          </Card>
        </>
      )}

      <Modal open={modalOpen} titleId="showcase-modal-title" title="Confirmar acción" onClose={() => setModalOpen(false)}>
        <p style={{ color: 'var(--cs-text-muted)', fontSize: 14 }}>
          Diálogo con foco atrapado, cierre con Escape y clic fuera (ESTANDAR_ACCESIBILIDAD §3–4).
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 20 }}>
          <Button variant="secondary" onClick={() => setModalOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={() => setModalOpen(false)}>Confirmar</Button>
        </div>
      </Modal>
    </main>
  );
}
