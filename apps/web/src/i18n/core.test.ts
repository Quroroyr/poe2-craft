/** The interface language layer: typed keys, EN fallback, plurals, formatting, and no stray text in code. */
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DEFAULT_LOCALE, createFormatters, createTranslator, type Messages } from './core';
import { en } from './en';
import { ru } from './ru';

describe('interface language', () => {
  it('English is the default', () => {
    expect(DEFAULT_LOCALE).toBe('en');
    expect(createTranslator('en')('masthead.section.craft')).toBe('Crafting');
  });

  it('Russian has exactly the English keys, with the same message shapes', () => {
    expect(Object.keys(ru).sort()).toEqual(Object.keys(en).sort());
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      expect(typeof ru[key], key).toBe(typeof en[key]);
    }
  });

  it('falls back to English for a missing key, and to the key itself after that', () => {
    const partial: Partial<Messages> = { 'masthead.section.craft': 'Крафт' };
    const t = createTranslator('ru', { en, ru: partial });
    expect(t('masthead.section.craft')).toBe('Крафт');
    expect(t('history.title')).toBe('Craft history');
    expect(createTranslator('ru', { en: {}, ru: {} })('history.title')).toBe('Craft history');
  });

  it('fills placeholders and chooses plural forms by count', () => {
    const tRu = createTranslator('ru');
    const tEn = createTranslator('en');
    expect(tEn('bases.select', { name: 'Akoyan Spear' })).toBe('Select Akoyan Spear');
    expect([1, 2, 5, 21].map((count) => tRu('strip.mods', { count }))).toEqual(['1 мод', '2 мода', '5 модов', '21 мод']);
    expect([1, 2].map((count) => tEn('strip.mods', { count }))).toEqual(['1 mod', '2 mods']);
  });

  it('formats numbers and times in the interface language', () => {
    const at = new Date(2026, 9, 2, 19, 5, 7).getTime();
    expect(createFormatters('ru').time(at)).toBe(new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(at));
    expect(createFormatters('en').time(at)).toMatch(/PM/);
    expect(createFormatters('ru').int(12345)).not.toBe(createFormatters('en').int(12345));
    expect(createFormatters('en').int(12345)).toBe('12,345');
  });

  it('no interface text is hard-coded outside the dictionaries', () => {
    const cyrillic = /[Ѐ-ӿ]/;
    const dirs = ['../components', '../lib'].map((d) => new URL(`${d}/`, import.meta.url));
    const offenders: string[] = [];
    for (const dir of dirs) {
      for (const file of readdirSync(dir)) {
        if (!/\.(ts|tsx)$/.test(file) || file.includes('.test.')) continue;
        readFileSync(new URL(file, dir), 'utf8')
          .split('\n')
          .forEach((line, i) => {
            const code = line.trim();
            const comment = code.startsWith('//') || code.startsWith('*') || code.startsWith('/*');
            if (!comment && cyrillic.test(code)) offenders.push(`${file}:${i + 1}`);
          });
      }
    }
    expect(offenders).toEqual([]);
  });
});
