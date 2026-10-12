/**
 * @monedero/i18n — punto único de entrada (web y móvil).
 * Uso RN: import { createTranslator } desde './translator' (sin React DOM).
 */
export {
  createTranslator,
  detectLocale,
  DICTIONARIES,
  esCO,
  enUS,
  type Locale,
  type TFunction,
  type TParams,
  type TranslationKey,
  type Dictionary,
} from './translator';

export {
  formatMoney,
  formatMoneySigned,
  formatAmountLive,
  formatMonthLabel,
  monthKeyOf,
  previousMonthKey,
  parseAmountToCents,
  symbolFor,
  decimalsFor,
  type CurrencyCode,
} from './format';
