/**
 * Interface language. Presentation state only: game rules, data and the craft session never see it.
 * Messages are flat typed keys; `{name}` placeholders are filled from params; a message can be a
 * plural set chosen by `params.count` (Intl.PluralRules). A key missing in a locale falls back to
 * English, then to the key itself.
 */
import { en } from './en';
import { ru } from './ru';

export type Locale = 'en' | 'ru';
export const LOCALES: readonly Locale[] = ['en', 'ru'];
export const DEFAULT_LOCALE: Locale = 'en';
export const LOCALE_STORAGE_KEY = 'poe2-craft.locale';

/** BCP 47 tags for Intl formatters. */
export const INTL_LOCALE: Record<Locale, string> = { en: 'en-US', ru: 'ru-RU' };

export interface PluralMessage {
  readonly one: string;
  readonly few?: string;
  readonly many?: string;
  readonly other: string;
}
export type Message = string | PluralMessage;
export type MessageKey = keyof typeof en;
export type Messages = Readonly<Record<MessageKey, Message>>;
export type Params = Readonly<Record<string, string | number>>;
export type Translator = (key: MessageKey, params?: Params) => string;

export const DICTIONARIES: Readonly<Record<Locale, Partial<Messages>>> = { en, ru };

export function isLocale(value: unknown): value is Locale {
  return value === 'en' || value === 'ru';
}

export function createTranslator(locale: Locale, dictionaries: Readonly<Record<Locale, Partial<Messages>>> = DICTIONARIES): Translator {
  const rules = new Intl.PluralRules(INTL_LOCALE[locale]);
  return (key, params) => {
    const message: Message | undefined = dictionaries[locale]?.[key] ?? dictionaries.en?.[key] ?? en[key];
    if (message === undefined) return key;
    const text = typeof message === 'string' ? message : plural(message, rules.select(Number(params?.count ?? 0)));
    return params ? interpolate(text, params) : text;
  };
}

function plural(message: PluralMessage, category: Intl.LDMLPluralRule): string {
  switch (category) {
    case 'one':
      return message.one;
    case 'few':
      return message.few ?? message.other;
    case 'many':
      return message.many ?? message.other;
    default:
      return message.other;
  }
}

function interpolate(text: string, params: Params): string {
  return text.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match));
}

/** Locale-dependent number and time formatting for the interface. */
export interface Formatters {
  readonly int: (n: number) => string;
  readonly time: (epochMs: number) => string;
}

export function createFormatters(locale: Locale): Formatters {
  const int = new Intl.NumberFormat(INTL_LOCALE[locale], { maximumFractionDigits: 0 });
  const time = new Intl.DateTimeFormat(INTL_LOCALE[locale], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  return {
    int: (n) => (Number.isFinite(n) ? int.format(n) : '∞'),
    time: (ms) => time.format(ms),
  };
}
