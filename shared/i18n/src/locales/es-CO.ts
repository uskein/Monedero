/**
 * Diccionario maestro es-CO — fuente de verdad de CLAVES.
 * ESTANDAR_INTERNACIONALIZACION.md: claves planas `seccion.elemento`, snake/camel prohibido.
 * Cualquier UI: cero strings hardcodeados → siempre t('clave').
 */
export const esCO = {
  // ── Común ──
  'app.name': 'Monedero',
  'app.tagline': 'Tus datos nunca salen de tu dispositivo.',
  'common.back': 'Atrás',
  'common.next': 'Continuar',
  'common.loading': 'Cargando…',
  'common.retry': 'Reintentar',
  'common.cancel': 'Cancelar',
  'common.confirm': 'Confirmar',
  'common.save': 'Guardar',
  'common.delete': 'Eliminar',
  'common.undo': 'Deshacer',
  'common.error.generic': 'Algo salió mal. Inténtalo de nuevo.',

  // ── Dashboard / inicio ──
  'home.lead': 'Gestor de gastos local — tus datos nunca salen de tu dispositivo.',
  'home.unlocked': 'Bóveda desbloqueada — dashboard en construcción (S3).',

  // ── Bóveda BP-01 / BP-02 ──
  'vault.lock.title': 'Bóveda bloqueada',
  'vault.lock.copy': 'Introduce tu contraseña maestra para descifrar tus datos locales.',
  'vault.lock.passphrase': 'Contraseña maestra',
  'vault.lock.submit': 'Desbloquear',
  'vault.lock.busy': 'Descifrando…',
  'vault.lock.error.wrong': 'Contraseña incorrecta. Tus datos siguen protegidos.',
  'vault.success.title': '¡Bóveda lista!',
  'vault.success.copy': 'Tus datos están cifrados en este dispositivo.',
  'vault.success.cta': 'Empezar',

  'vault.onboarding.welcome.title': 'Bienvenido a Monedero',
  'vault.onboarding.welcome.copy': 'Tus gastos viven solo en este dispositivo. Sin nube, sin cuentas, sin telemetría.',
  'vault.onboarding.create.title': 'Crea tu contraseña maestra',
  'vault.onboarding.create.copy': 'Cifra todo con AES-256-GCM. Si la olvidas, nadie —ni nosotros— puede recuperarla.',
  'vault.onboarding.passphrase': 'Contraseña maestra',
  'vault.onboarding.passphrase.hint': 'Mínimo 8 caracteres',
  'vault.onboarding.confirm': 'Repite la contraseña',
  'vault.onboarding.confirm.hint': 'Escribe la misma contraseña',
  'vault.onboarding.error.min': 'La contraseña debe tener al menos 8 caracteres.',
  'vault.onboarding.error.match': 'Las contraseñas no coinciden.',
  'vault.onboarding.finish': 'Crear bóveda',
  'vault.onboarding.busy': 'Cifrando…',
  'vault.onboarding.step': '{current} de {total}',
} as const;

export type TranslationKey = keyof typeof esCO;
export type Dictionary = Record<TranslationKey, string>;
