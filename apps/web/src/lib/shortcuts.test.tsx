// @vitest-environment happy-dom
/**
 * History shortcuts are matched by the physical key, so they work on any keyboard layout. On the
 * Russian layout the Z key reports key "я" (Shift: "Я") and Y reports "н" — `code` stays KeyZ / KeyY.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { $, click, demoSession, keyOn, paste, renderWorkspace, type Mounted } from '@/test-utils';
import { historyShortcut } from './shortcuts';

const ev = (init: Partial<KeyboardEvent>) => ({ code: '', key: '', ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...init });

describe('historyShortcut', () => {
  it('reads the physical key on the Russian layout', () => {
    expect(historyShortcut(ev({ key: 'я', code: 'KeyZ', ctrlKey: true }))).toBe('undo');
    expect(historyShortcut(ev({ key: 'Я', code: 'KeyZ', ctrlKey: true, shiftKey: true }))).toBe('redo');
    expect(historyShortcut(ev({ key: 'н', code: 'KeyY', ctrlKey: true }))).toBe('redo');
  });

  it('Mac Cmd works the same way', () => {
    expect(historyShortcut(ev({ key: 'я', code: 'KeyZ', metaKey: true }))).toBe('undo');
    expect(historyShortcut(ev({ key: 'Я', code: 'KeyZ', metaKey: true, shiftKey: true }))).toBe('redo');
    expect(historyShortcut(ev({ key: 'н', code: 'KeyY', metaKey: true }))).toBe('redo');
  });

  it('follows the physical key, not the letter: a layout where Z sits elsewhere does not move undo', () => {
    // German layout: the key labelled Z is where KeyY is; it reports key "z" and code "KeyY".
    expect(historyShortcut(ev({ key: 'z', code: 'KeyY', ctrlKey: true }))).toBe('redo');
    expect(historyShortcut(ev({ key: 'я', code: 'KeyX', ctrlKey: true }))).toBeNull();
  });

  it('needs Ctrl or Cmd, and leaves AltGr / Alt combinations alone', () => {
    expect(historyShortcut(ev({ key: 'я', code: 'KeyZ' }))).toBeNull();
    expect(historyShortcut(ev({ key: 'z', code: 'KeyZ', ctrlKey: true, altKey: true }))).toBeNull();
    expect(historyShortcut(ev({ key: 'v', code: 'KeyV', ctrlKey: true }))).toBeNull();
  });

  it('without a code (some virtual keyboards) falls back to a Latin key only', () => {
    expect(historyShortcut(ev({ key: 'z', ctrlKey: true }))).toBe('undo');
    expect(historyShortcut(ev({ key: 'я', ctrlKey: true }))).toBeNull();
  });
});

describe('history shortcuts on the page, Russian layout', () => {
  let mounted: Mounted;
  let root: HTMLDivElement;
  beforeEach(async () => {
    localStorage.clear();
    mounted = await renderWorkspace({ locale: 'ru', session: demoSession() });
    root = mounted.container;
    await click($('.panel-current .craft-zone', root));
    await click($('.panel-current .craft-zone', root));
  });
  afterEach(async () => {
    await mounted.unmount();
  });
  const states = () => [...root.querySelectorAll('.panel-history .history-row')].map((r) => (r.className.includes('history-undone') ? 'undone' : 'applied'));
  const mods = () => root.querySelectorAll('.panel-current .current-mod').length;

  it('Ctrl+Z (я) undoes, Ctrl+Shift+Z (Я) and Ctrl+Y (н) redo', async () => {
    const after = mods();
    await keyOn(window, 'я', { ctrlKey: true, code: 'KeyZ' });
    expect(states()).toEqual(['undone', 'applied']);
    expect(mods()).toBe(after - 1);
    await keyOn(window, 'я', { ctrlKey: true, code: 'KeyZ' });
    expect(states()).toEqual(['undone', 'undone']);
    await keyOn(window, 'Я', { ctrlKey: true, shiftKey: true, code: 'KeyZ' });
    expect(states()).toEqual(['undone', 'applied']);
    await keyOn(window, 'н', { ctrlKey: true, code: 'KeyY' });
    expect(states()).toEqual(['applied', 'applied']);
    expect(mods()).toBe(after);
  });

  it('Cmd variants on a Mac', async () => {
    await keyOn(window, 'я', { metaKey: true, code: 'KeyZ' });
    expect(states()).toEqual(['undone', 'applied']);
    await keyOn(window, 'н', { metaKey: true, code: 'KeyY' });
    expect(states()).toEqual(['applied', 'applied']);
  });

  it('inside a text field the browser keeps its own undo: the session does not move', async () => {
    const input = root.querySelector<HTMLInputElement>('input[type="search"]')!;
    input.focus();
    await keyOn(input, 'я', { ctrlKey: true, code: 'KeyZ' });
    await keyOn(input, 'н', { ctrlKey: true, code: 'KeyY' });
    await keyOn(input, 'Я', { ctrlKey: true, shiftKey: true, code: 'KeyZ' });
    expect(states()).toEqual(['applied', 'applied']);
  });

  it('a paste on the Russian layout still imports (the paste event carries no layout)', async () => {
    // Ctrl+V on RU reports key "м"; the page does not handle it as a shortcut, the paste event does the work.
    await keyOn(window, 'м', { ctrlKey: true, code: 'KeyV' });
    expect(states()).toEqual(['applied', 'applied']);
    await paste('Item Class: Spears\nRarity: Rare\nDoom Song\nWar Spear\n--------\nItem Level: 70\n--------\n+18 to Dexterity');
    expect(document.querySelector('.preview-dialog')?.textContent).toContain('War Spear');
  });
});
