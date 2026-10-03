// @vitest-environment happy-dom
/**
 * Entry flows and the main layout (v0.7): an empty first visit, import by Ctrl+V or button through
 * one preview, Create New Item on the setup surface, the current item as the workbench with the
 * target beside it, and the EN / RU interface.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SAMPLE_ITEMS, SAMPLE_TARGET_ITEMS } from '@poe2-craft/item-parser';
import { LOCALE_STORAGE_KEY } from '@/i18n/core';
import { $ as query, button, click, demoSession, keyOn, paste, renderWorkspace, setField, type Mounted } from '@/test-utils';

const SPEAR = SAMPLE_ITEMS[0]!.text;
const WAR_SPEAR = 'Item Class: Spears\nRarity: Rare\nDoom Song\nWar Spear\n--------\nItem Level: 70\n--------\n+18 to Dexterity';

let mounted: Mounted | null = null;
const mount = async (options: Parameters<typeof renderWorkspace>[0] = {}) => {
  mounted = await renderWorkspace(options);
  return mounted;
};
beforeEach(() => {
  localStorage.clear();
});
afterEach(async () => {
  await mounted?.unmount();
  mounted = null;
});

const root = () => mounted!.container;
const $ = <T extends Element = HTMLElement>(selector: string) => query<T>(selector, root());
const has = (selector: string) => root().querySelector(selector) !== null;
const preview = () => root().querySelector<HTMLDialogElement>('.preview-dialog .confirm-sheet');
const historyRows = () => root().querySelectorAll('.panel-history .history-row');
const targetRows = () => root().querySelectorAll('.panel-target .target-rows > li');

const startFromPaste = async (text = SPEAR) => {
  await paste(text);
  await click(button(preview()!, 'Start crafting'));
};

describe('initial state', () => {
  it('a first visit is empty: start screen, empty target, no sample loaded', async () => {
    await mount();
    expect(has('.start-screen')).toBe(true);
    expect($('.start-screen').textContent).toContain('Start a new craft');
    expect($('.start-screen').textContent).toContain('Ctrl+V');
    expect(has('.panel-current')).toBe(false);
    expect(has('.panel-source')).toBe(false);
    expect(has('.panel-history')).toBe(false);
    expect(has('.panel-spending')).toBe(false);
    expect($('.panel-target').textContent).toContain('Target not set');
    expect(root().textContent).not.toContain('Akoyan Spear');
  });
});

describe('import', () => {
  it('Ctrl+V with a game item opens the preview; nothing starts before confirmation', async () => {
    await mount();
    await paste(SPEAR);
    expect(preview()?.textContent).toContain('Imported item');
    expect(preview()?.textContent).toContain('Akoyan Spear');
    expect(preview()?.textContent).toContain('1 fractured');
    expect(has('.panel-current')).toBe(false);
  });

  it('ignores text that is not an item, and pastes into text fields', async () => {
    await mount();
    await paste('https://example.com just a note');
    expect(preview()).toBeNull();
    const input = document.createElement('input');
    root().append(input);
    await paste(SPEAR, input);
    expect(preview()).toBeNull();
  });

  it('cancel returns to the start screen; start crafting opens the workspace', async () => {
    await mount();
    await paste(SPEAR);
    await click(button(preview()!, 'Cancel'));
    expect(preview()).toBeNull();
    expect(has('.start-screen')).toBe(true);

    await startFromPaste();
    expect(has('.start-screen')).toBe(false);
    expect($('.panel-current').textContent).toContain('Akoyan Spear');
    expect($('.start-strip').textContent).toContain('Akoyan Spear');
    expect(has('.panel-target')).toBe(true);
    expect(historyRows()).toHaveLength(0);
  });

  it('the Import button uses the same recognition and preview', async () => {
    await mount();
    await click(button($('.start-screen'), 'Import item'));
    const dialog = $('.import-dialog');
    await setField(dialog.querySelector('textarea')!, 'not an item');
    await click(button(dialog, 'Preview'));
    expect(dialog.textContent).toContain('not a Path of Exile item');
    await setField(dialog.querySelector('textarea')!, SPEAR);
    await click(button(dialog, 'Preview'));
    expect(preview()?.textContent).toContain('Akoyan Spear');
  });
});

/** Base selector steps: item type tile → class tile → base row (lib/base-navigation.ts). */
async function chooseBase(...steps: string[]) {
  const dialog = $('.base-dialog');
  for (const step of steps.slice(0, -1)) await click([...dialog.querySelectorAll('.nav-tile')].find((t) => t.querySelector('.nav-tile-title')?.textContent === step)!);
  await click($(`[aria-label="Select ${steps[steps.length - 1]}"]`));
}

describe('create new item', () => {
  it('builds the starting item on the setup surface, then starts the craft', async () => {
    await mount();
    await click(button($('.start-screen'), 'Create new item'));
    expect(has('.setup-surface')).toBe(true);
    expect($('.setup-surface').textContent).toContain('Create new item');
    await chooseBase('One-handed weapons', 'Spears', 'Hardwood Spear');
    expect($('.setup-surface .panel-source').textContent).toContain('Hardwood Spear');
    await click(button($('.setup-surface .setup-actions'), 'Create item'));
    expect(has('.setup-surface')).toBe(false);
    expect($('.panel-current').textContent).toContain('Hardwood Spear');
    expect(historyRows()).toHaveLength(0);
  });

  it('cancel leaves no session behind', async () => {
    await mount();
    await click(button($('.start-screen'), 'Create new item'));
    await chooseBase('One-handed weapons', 'Spears', 'Hardwood Spear');
    await click(button($('.setup-surface .setup-actions'), 'Cancel'));
    expect(has('.start-screen')).toBe(true);
    expect(has('.panel-current')).toBe(false);
  });
});

describe('active layout', () => {
  it('the current item and the target are the top row; the starting item is a strip with its own surface', async () => {
    await mount({ session: demoSession() });
    const top = $('.row-main');
    expect(top.querySelector('.panel-current')).not.toBeNull();
    expect(top.querySelector('.panel-target')).not.toBeNull();
    expect(has('.panel-source')).toBe(false);

    await click(button($('.start-strip'), 'Edit starting item'));
    expect($('.setup-surface').textContent).toContain('Edit starting item');
    expect(has('.setup-surface .panel-source')).toBe(true);
    await click(button($('.setup-surface .setup-actions'), 'Cancel'));
    expect(has('.panel-source')).toBe(false);
  });

  it('editing the starting item after crafting shows out-of-sync and offers a reset', async () => {
    await mount({ session: demoSession() });
    await click($('.panel-current .craft-zone'));
    await click(button($('.start-strip'), 'Edit starting item'));
    await click($('.setup-surface .panel-source [aria-label="Remove modifier"]'));
    await click(button($('.setup-surface .setup-actions'), 'Save starting item'));
    expect($('.panel-current').textContent).toContain('no longer comes from it');
    expect(historyRows()).toHaveLength(1);
    await click(button($('.panel-current'), 'Reset to starting item'));
    expect($('.panel-current').textContent).not.toContain('no longer comes from it');
    expect(historyRows()).toHaveLength(0);
  });
});

describe('target', () => {
  it('build target: empty requirements on the current base, picker opens', async () => {
    await mount();
    expect(button($('.panel-target'), 'Build target').disabled).toBe(true);
    await startFromPaste();
    await click(button($('.panel-target'), 'Build target'));
    expect($('.panel-target').textContent).toContain('No requirements');
    expect($('.panel-pool .mode-line-edit').textContent).toContain('Adding a requirement to the target');
  });

  it('import target through the shared dialog', async () => {
    await mount();
    await click(button($('.panel-target'), 'Import target'));
    const dialog = $('.import-dialog');
    await setField(dialog.querySelector('textarea')!, SAMPLE_TARGET_ITEMS[0]!.text);
    await click(button(dialog, 'Set as target'));
    expect(targetRows().length).toBeGreaterThan(0);
    // A target alone does not start a craft.
    expect(has('.start-screen')).toBe(true);
  });

  it('"use current as base" copies tier requirements, not rolled values; source and current stay', async () => {
    await mount();
    await startFromPaste();
    // The item itself (texts and tiers), not its target badges, which do change.
    const item = () => [...root().querySelectorAll('.panel-current .current-mod')].map((li) => `${li.querySelector('.mod-text')?.textContent} ${li.querySelector('.tier-badge')?.textContent}`);
    const currentBefore = item();
    await click(button($('.panel-target'), 'Use current as base'));
    expect(targetRows()).toHaveLength(1);
    expect(targetRows()[0]!.querySelector('.mod-text')!.textContent).toBe('+(3.21–4.4)% to Critical Hit Chance');
    expect(targetRows()[0]!.textContent).toContain('fractured');
    expect(item()).toEqual(currentBefore);
  });

  it('stays visible next to the current item while crafting', async () => {
    await mount({ session: demoSession() });
    await click($('.panel-current .craft-zone'));
    expect($('.row-main .panel-target').textContent).toContain('Target progress');
  });
});

describe('Ctrl+V during an active craft', () => {
  it('asks first; confirming starts over and keeps the target (with the base warning)', async () => {
    await mount({ session: demoSession() });
    await click($('.panel-current .craft-zone'));
    const requirementsBefore = targetRows().length;

    await paste(WAR_SPEAR);
    expect(preview()?.textContent).toContain('Start a new craft with this item?');
    expect(historyRows()).toHaveLength(1);
    await click(button(preview()!, 'Cancel'));
    expect($('.panel-current').textContent).toContain('Akoyan Spear');

    await paste(WAR_SPEAR);
    await click(button(preview()!, 'Start new craft'));
    expect($('.panel-current').textContent).toContain('War Spear');
    expect(historyRows()).toHaveLength(0);
    expect(targetRows()).toHaveLength(requirementsBefore);
    expect(has('.target-mismatch')).toBe(true);
  });
});

describe('interface language', () => {
  it('EN by default; RU switches the whole shell and survives in localStorage; back to EN', async () => {
    await mount({ session: demoSession() });
    expect($('.sections').textContent).toBe('Crafting');
    expect(document.documentElement.lang).toBe('en');

    await click(button($('.locale-switch'), 'RU'));
    expect($('.sections').textContent).toBe('Крафт');
    expect($('.panel-current h2').textContent).toContain('Текущий предмет');
    expect($('.panel-target h2').textContent).toContain('Целевой предмет');
    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('ru');
    expect(document.documentElement.lang).toBe('ru');
    // The session is untouched by the switch.
    expect($('.panel-current').textContent).toContain('Akoyan Spear');

    await click(button($('.locale-switch'), 'EN'));
    expect($('.panel-current h2').textContent).toContain('Current item');
    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('en');
  });

  it('a stored choice is restored on the next visit', async () => {
    localStorage.setItem(LOCALE_STORAGE_KEY, 'ru');
    await mount();
    expect($('.start-screen').textContent).toContain('Новый крафт');
  });

  it('history, spending, aria labels and the v0.6 menu follow the language', async () => {
    await mount({ locale: 'ru', session: demoSession() });
    await click($('.panel-current .craft-zone'));
    expect($('.panel-history thead').textContent).toContain('Действие');
    expect($('.panel-spending').textContent).toContain('Потрачено всего');
    expect($('.panel-current [aria-label="Отменить (Ctrl+Z)"]')).not.toBeNull();
    // 24-hour time in Russian.
    expect(historyRows()[0]!.textContent).toMatch(/\d{2}:\d{2}:\d{2}/);
    const mod = [...root().querySelectorAll('.panel-current .current-mod')].find((li) => li.textContent?.includes('Critical Hit Chance'))!;
    await click(mod.querySelector('.mod-more')!);
    expect(document.querySelector('.ctx-menu')?.textContent).toContain('Повысить на тир');
    await keyOn(document, 'Escape');
  });

  it('English history uses the English clock', async () => {
    await mount({ session: demoSession() });
    await click($('.panel-current .craft-zone'));
    expect(historyRows()[0]!.textContent).toMatch(/AM|PM/);
  });
});

describe('v0.6 behaviour on the new layout', () => {
  it('currency + Omen craft, manual edit, undo / redo and the spending warning', async () => {
    await mount({ session: demoSession() });
    // "Usable" (default) lists currencies and omens in one strip, no category tabs.
    await click($('.panel-tools [aria-label="Tools"] [title^="Omen of Dextral Exaltation"]'));
    await click($('.panel-current .craft-zone'));
    expect(historyRows()[0]!.textContent).toContain('Omen');

    const mod = [...root().querySelectorAll('.panel-current .current-mod')].find((li) => li.textContent?.includes('Critical Hit Chance'))!;
    await click(mod.querySelector('.mod-more')!);
    await click(document.querySelector('.ctx-menu [data-id="fracture"]')!);
    await click(button(document.querySelector('.confirm-dialog .confirm-sheet')!, 'Got it'));
    expect(historyRows()[0]!.className).toContain('history-manual');
    expect($('.panel-spending').textContent).toContain('manual edits');
    expect($('.panel-spending .money-fact .money-note').textContent).toContain('1 step');

    await keyOn(window, 'z', { ctrlKey: true });
    expect(root().querySelectorAll('.panel-history .history-manual.history-undone')).toHaveLength(1);
    await keyOn(window, 'z', { ctrlKey: true, shiftKey: true });
    expect(root().querySelectorAll('.panel-history .history-manual.history-current')).toHaveLength(1);
  });
});
