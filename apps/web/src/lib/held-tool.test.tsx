/**
 * The held-tool cursor: what it shows for each tool state, and that the overlay can never be the
 * thing that applies a craft (it has no interactive markup and lets pointer events through).
 */
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { EMPTY_TOOL, resolveTool, selectCurrency, toggleOmen } from '@poe2-craft/craft-session';
import { HeldToolGlyph } from '@/components/HeldToolCursor';
import { craftDb, DEFAULT_GAME_VERSION } from './analyze';
import { createTranslator } from '@/i18n/core';
import { heldTool as heldToolT } from './held-tool';

const heldTool = (...args: Parameters<typeof heldToolT> extends [unknown, ...infer R] ? R : never) => heldToolT(createTranslator('en'), ...args);

const view = craftDb.forVersion(DEFAULT_GAME_VERSION);
const EXALT = selectCurrency(EMPTY_TOOL, 'currency.exalted-orb');

describe('held tool', () => {
  it('holds nothing without a selected currency', () => {
    expect(heldTool(resolveTool(view, EMPTY_TOOL), null)).toBeNull();
  });

  it('shows the selected currency, then the omen, as ready when a click would apply', () => {
    const held = heldTool(resolveTool(view, toggleOmen(EXALT, 'omen.dextral-exaltation')), null);
    expect(held?.state).toBe('ready');
    expect(held?.icons.map((i) => [i.name, i.role])).toEqual([
      ['Exalted Orb', 'currency'],
      ['Omen of Dextral Exaltation', 'omen'],
    ]);
    expect(held?.icons[0]?.src).toBe('/icons/game/CurrencyAddModToRare.png');
  });

  it('keeps showing the omen as a badge when the currency changes, with the right state', () => {
    const withOmen = toggleOmen(EXALT, 'omen.dextral-exaltation');
    const divine = heldTool(resolveTool(view, selectCurrency(withOmen, 'currency.divine-orb')), null);
    expect(divine?.icons.map((i) => i.name)).toEqual(['Divine Orb', 'Omen of Dextral Exaltation']);
    expect(divine).toMatchObject({ state: 'blocked', reason: 'this Omen does not work with this currency' });
    const perfect = heldTool(resolveTool(view, selectCurrency(withOmen, 'currency.perfect-exalted-orb')), null);
    expect(perfect).toMatchObject({ state: 'blocked', reason: 'combination not modelled' });
    // An omen alone is not held on the pointer: it waits for a currency in the active craft panel.
    expect(heldTool(resolveTool(view, toggleOmen(EMPTY_TOOL, 'omen.dextral-exaltation')), null)).toBeNull();
  });

  it('is blocked, with the reason, when the item cannot take the click or the combination has no model', () => {
    expect(heldTool(resolveTool(view, EXALT), 'Нет свободного суффикса.')).toMatchObject({
      state: 'blocked',
      reason: 'Нет свободного суффикса.',
    });
    const odd = toggleOmen(selectCurrency(EMPTY_TOOL, 'currency.perfect-exalted-orb'), 'omen.dextral-exaltation');
    expect(heldTool(resolveTool(view, odd), null)?.state).toBe('blocked');
  });
});

describe('held tool overlay', () => {
  const markup = (blocked: boolean) =>
    renderToStaticMarkup(
      <HeldToolGlyph tool={heldTool(resolveTool(view, EXALT), blocked ? 'нет слота' : null)!} pulseKey={1} />,
    );

  it('draws the omen as a badge next to the held currency', () => {
    const tool = heldTool(resolveTool(view, toggleOmen(EXALT, 'omen.dextral-exaltation')), null)!;
    const html = renderToStaticMarkup(<HeldToolGlyph tool={tool} pulseKey={1} />);
    expect(html).toMatch(/class="held-main"[^>]*CurrencyAddModToRare/);
    expect(html).toMatch(/class="held-extra"[^>]*VoodooOmens3Yellow/);
  });

  it('is hidden from assistive tech and contains nothing clickable or focusable', () => {
    for (const html of [markup(false), markup(true)]) {
      expect(html).toMatch(/<div class="held-cursor held-(ready|blocked)" aria-hidden="true"/);
      expect(html).not.toMatch(/<(button|a|input|select|textarea)\b|role="button"|tabindex|onclick/i);
    }
    expect(markup(true)).toContain('нет слота');
  });

  it('lets pointer events through to the item underneath', () => {
    const css = readFileSync(new URL('../app/planner.css', import.meta.url), 'utf8');
    const rule = /\.held-cursor\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(rule).toMatch(/pointer-events:\s*none/);
    expect(rule).toMatch(/position:\s*fixed/);
  });
});
