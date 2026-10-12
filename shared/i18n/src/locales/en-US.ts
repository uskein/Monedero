import type { Dictionary } from './es-CO';

/** en-US — traducción completa; el gate i18n verifica paridad de claves. */
export const enUS: Dictionary = {
  'app.name': 'Monedero',
  'app.tagline': 'Your data never leaves your device.',
  'common.back': 'Back',
  'common.next': 'Continue',
  'common.loading': 'Loading…',
  'common.retry': 'Retry',
  'common.cancel': 'Cancel',
  'common.confirm': 'Confirm',
  'common.save': 'Save',
  'common.delete': 'Delete',
  'common.undo': 'Undo',
  'common.error.generic': 'Something went wrong. Please try again.',

  'home.lead': 'Local expense tracker — your data never leaves your device.',
  'home.unlocked': 'Vault unlocked — dashboard under construction (S3).',

  'vault.lock.title': 'Vault locked',
  'vault.lock.copy': 'Enter your master password to decrypt your local data.',
  'vault.lock.passphrase': 'Master password',
  'vault.lock.submit': 'Unlock',
  'vault.lock.busy': 'Decrypting…',
  'vault.lock.error.wrong': 'Incorrect password. Your data stays protected.',
  'vault.success.title': 'Vault ready!',
  'vault.success.copy': 'Your data is encrypted on this device.',
  'vault.success.cta': 'Get started',

  'vault.onboarding.welcome.title': 'Welcome to Monedero',
  'vault.onboarding.welcome.copy': 'Your expenses live only on this device. No cloud, no accounts, no telemetry.',
  'vault.onboarding.create.title': 'Create your master password',
  'vault.onboarding.create.copy': 'Everything is encrypted with AES-256-GCM. If you forget it, nobody —not even us— can recover it.',
  'vault.onboarding.passphrase': 'Master password',
  'vault.onboarding.passphrase.hint': 'At least 8 characters',
  'vault.onboarding.confirm': 'Repeat the password',
  'vault.onboarding.confirm.hint': 'Type the same password',
  'vault.onboarding.error.min': 'The password must be at least 8 characters.',
  'vault.onboarding.error.match': 'The passwords do not match.',
  'vault.onboarding.finish': 'Create vault',
  'vault.onboarding.busy': 'Encrypting…',
  'vault.onboarding.step': '{current} of {total}',
};
