/**
 * Errores de dominio — códigos estables (CONTRATOS_API.md).
 * messageKey apunta a claves i18n `errors.*`; el usuario NUNCA ve el código crudo en prod.
 */
export type DomainErrorCode =
  | 'VALIDATION_FAILED'
  | 'VAULT_LOCKED'
  | 'VAULT_WRONG_PASSPHRASE'
  | 'VAULT_ALREADY_EXISTS'
  | 'IMPORT_FILE_INVALID'
  | 'IMPORT_VERSION_UNSUPPORTED'
  | 'IMPORT_INTEGRITY_FAIL'
  | 'IMPORT_DECRYPT_FAIL'
  | 'EXPORT_FAILED'
  | 'MONEY_NOT_INTEGER'
  | 'BUDGET_ALREADY_EXISTS';

export class DomainError extends Error {
  readonly code: DomainErrorCode;
  readonly field?: string;

  constructor(code: DomainErrorCode, field?: string) {
    super(code);
    this.name = 'DomainError';
    this.code = code;
    if (field !== undefined) this.field = field;
  }

  get messageKey(): string {
    return `errors.${this.code.toLowerCase()}`;
  }
}
