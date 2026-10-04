// @vitest-environment happy-dom
/**
 * Modifier context menus on the source, current and target cards, in the real workspace. The
 * sample source carries a fractured local critical chance T1; the sample target asks for it too.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { button, click, demoSession, renderWorkspace, run as act$, type Mounted } from '@/test-utils';
import { placeMenu } from './ContextMenu';

// Russian interface on the v0.6 demo session: the menus are checked in RU here, in EN in Entry.test.
let mounted: Mounted;
let container: HTMLDivElement;
beforeEach(async () => {
  mounted = await renderWorkspace({ locale: 'ru', session: demoSession() });
  container = mounted.container;
});
afterEach(async () => {
  await mounted.unmount();
});

const $ = <T extends Element = HTMLElement>(selector: string, scope: ParentNode = container) => {
  const el = scope.querySelector(selector);
  if (!el) throw new Error(`not found: ${selector}`);
  return el as unknown as T;
};
const rightClick = async (el: Element) => {
  let notCancelled = true;
  await act$(() => {
    notCancelled = el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 40, clientY: 40 }));
  });
  return notCancelled;
};
const keyOn = (target: EventTarget, key: string, init: KeyboardEventInit = {}) =>
  act$(() => target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init })));

const menu = () => document.querySelector<HTMLElement>('.ctx-menu');
const menuItem = (id: string) => $(`.ctx-menu [data-id="${id}"]`, document);
const menuIds = () => [...document.querySelectorAll<HTMLElement>('.ctx-menu [data-id]')].map((el) => el.dataset.id);
const choose = async (id: string) => click(menuItem(id));

const currentMod = (text: string) => {
  const found = [...container.querySelectorAll('.panel-current .current-mod')].find((li) => li.textContent?.includes(text));
  if (!found) throw new Error(`no current modifier "${text}"`);
  return found as HTMLElement;
};
const currentTexts = () => [...container.querySelectorAll('.panel-current .current-mod .mod-text')].map((el) => el.textContent);
/** Starting modifiers live on the setup surface: chips of the open surface. */
const sourceChip = (text: string) =>
  [...container.querySelectorAll<HTMLElement>('.setup-surface .mod-chip')].find((li) => li.textContent?.includes(text))!;
const openSource = () => click(button($('.start-strip'), 'Изменить исходный'));
/** The session's starting item, read through the setup surface and closed again without saving. */
const sourceState = async () => {
  await openSource();
  const chips = [...container.querySelectorAll<HTMLElement>('.setup-surface .mod-chip')].map(
    (li) =>
      `${li.querySelector('.mod-text')?.textContent} ${li.querySelector('select')?.value}${li.className.includes('mod-chip-fractured') ? ' fractured' : ''}`,
  );
  await click(button($('.setup-surface .setup-actions'), 'Отмена'));
  return chips.join(' | ');
};
const targetRows = () => [...container.querySelectorAll<HTMLElement>('.panel-target .target-rows > li')];
const targetRow = (text: string) => targetRows().find((li) => li.textContent?.includes(text))!;
/** The requirements themselves (text + minimum tier), without their state against the current item. */
const requirements = () =>
  targetRows().map((li) => `${li.querySelector('.mod-text')?.textContent} ${li.querySelector('select')?.value}`);
const historyRows = () => [...container.querySelectorAll<HTMLElement>('.panel-history .history-row')];
const spentNote = () => $('.panel-spending .money-fact .money-note').textContent;
const dialog = () => container.querySelector<HTMLDialogElement>('.confirm-dialog');

const craft = async (times: number) => {
  for (let i = 0; i < times; i++) await click($('.panel-current .craft-zone'));
};
/** Confirms the one-time notice if it is up. */
const confirmNotice = async () => {
  const sheet = dialog()?.querySelector('.confirm-sheet');
  if (sheet) await click(button(sheet, 'Понятно'));
};

describe('context menu', () => {
  it('a right click on a modifier opens its menu instead of the browser menu, and never crafts', async () => {
    const notCancelled = await rightClick(currentMod('Critical Hit Chance'));
    expect(notCancelled).toBe(false);
    expect(menu()).not.toBeNull();
    expect(menu()!.getAttribute('role')).toBe('menu');
    expect(historyRows()).toHaveLength(0);
  });

  it('Escape closes it — and does not also leave the pool editing mode', async () => {
    await rightClick(currentMod('Critical Hit Chance'));
    await choose('replace');
    await confirmNotice();
    expect(container.querySelector('.panel-pool .mode-line-edit')).not.toBeNull();
    await rightClick(currentMod('Critical Hit Chance'));
    await keyOn(document.activeElement ?? document, 'Escape');
    expect(menu()).toBeNull();
    expect(container.querySelector('.panel-pool .mode-line-edit')).not.toBeNull();
  });

  it('a click outside closes it', async () => {
    await rightClick(currentMod('Critical Hit Chance'));
    await act$(() => document.body.dispatchEvent(new Event('pointerdown', { bubbles: true })));
    expect(menu()).toBeNull();
  });

  it('the "…" button opens the same menu (keyboard and touch path)', async () => {
    await rightClick(currentMod('Critical Hit Chance'));
    const viaRightClick = menuIds();
    await keyOn(document, 'Escape');
    const more = $('.mod-more', currentMod('Critical Hit Chance'));
    await click(more);
    expect(menuIds()).toEqual(viaRightClick);
    expect(more.getAttribute('aria-expanded')).toBe('true');
    // Its click stays on the button: no craft step was made.
    expect(historyRows()).toHaveLength(0);
  });

  it('stays inside the viewport', () => {
    expect(placeMenu(100, 100, 300, 200, 1440, 900)).toEqual({ left: 100, top: 100 });
    // Near the right / bottom edge it flips to the other side of the pointer.
    expect(placeMenu(1400, 850, 300, 200, 1440, 900)).toEqual({ left: 1100, top: 650 });
    // A phone: wider than the room on either side → pinned to the margin.
    expect(placeMenu(200, 300, 340, 400, 390, 844)).toEqual({ left: 8, top: 300 });
    // Taller than the screen: pinned to the top margin (the menu scrolls inside, max-height in CSS).
    expect(placeMenu(380, 830, 340, 900, 390, 844)).toEqual({ left: 40, top: 8 });
  });
});

describe('manual edits of the current item from the menu', () => {
  it('asks once, then edits current only: tier, history, no spending', async () => {
    await craft(2);
    expect(spentNote()).toContain('2 шага');
    await rightClick(currentMod('Critical Hit Chance'));
    expect(menuItem('upgrade').getAttribute('aria-disabled')).toBe('true'); // T1 is the best tier
    await choose('tier');
    expect(menuItem('tier-mod.local-critical-chance.t1').getAttribute('aria-checked')).toBe('true');
    await choose('tier-mod.local-critical-chance.t2');

    // The one-time notice: cancel changes nothing.
    expect(dialog()?.textContent).toContain('не является игровым крафтом');
    await click(button(dialog()!, 'Отмена'));
    expect(currentMod('Critical Hit Chance').querySelector('.tier-badge')?.textContent).toBe('T1');

    await rightClick(currentMod('Critical Hit Chance'));
    await choose('tier');
    await choose('tier-mod.local-critical-chance.t2');
    await confirmNotice();
    expect(currentMod('Critical Hit Chance').querySelector('.tier-badge')?.textContent).toBe('T2');
    expect(await sourceState()).toContain('mod.local-critical-chance.t1');
    expect(historyRows()[0]!.className).toContain('history-manual');
    expect(historyRows()[0]!.textContent).toContain('T1 → T2');
    expect(spentNote()).toContain('2 шага');
    expect(container.querySelector('.spent-manual')?.textContent).toContain('ручные изменения');

    // Upgrade one tier goes back to T1 — and the notice is not asked again.
    await rightClick(currentMod('Critical Hit Chance'));
    expect(menuItem('upgrade').textContent).toContain('T1');
    await choose('upgrade');
    expect(dialog()?.querySelector('.confirm-sheet')).toBeNull();
    expect(currentMod('Critical Hit Chance').querySelector('.tier-badge')?.textContent).toBe('T1');
  });

  it('unfracture, fracture and remove; Ctrl+Z / Ctrl+Shift+Z step through them', async () => {
    await rightClick(currentMod('Critical Hit Chance'));
    expect(menuItem('fracture').textContent).toContain('Снять Fractured');
    await choose('fracture');
    await confirmNotice();
    expect(currentMod('Critical Hit Chance').className).not.toContain('is-fractured');

    await rightClick(currentMod('Critical Hit Chance'));
    expect(menuItem('fracture').textContent).toContain('Сделать Fractured');
    await choose('fracture');
    expect(currentMod('Critical Hit Chance').className).toContain('is-fractured');

    await rightClick(currentMod('Critical Hit Chance'));
    await choose('remove');
    expect(currentTexts().some((t) => t?.includes('Critical Hit Chance'))).toBe(false);
    expect(await sourceState()).toContain('Critical Hit Chance');
    expect(historyRows().filter((r) => r.className.includes('history-manual'))).toHaveLength(3);

    await keyOn(window, 'z', { ctrlKey: true });
    expect(currentMod('Critical Hit Chance').className).toContain('is-fractured');
    await keyOn(window, 'z', { ctrlKey: true });
    expect(currentMod('Critical Hit Chance').className).not.toContain('is-fractured');
    await keyOn(window, 'z', { ctrlKey: true, shiftKey: true });
    await keyOn(window, 'z', { ctrlKey: true, shiftKey: true });
    expect(currentTexts().some((t) => t?.includes('Critical Hit Chance'))).toBe(false);
    expect(spentNote()).toContain('0 шагов');
  });

  it('"replace from pool" uses the existing picker; source and target stay as they were', async () => {
    const targetBefore = requirements();
    await rightClick(currentMod('Critical Hit Chance'));
    await choose('replace');
    expect($('.panel-pool .mode-line-edit').textContent).toContain('ручная правка');
    await click([...container.querySelectorAll('.panel-pool .family-item')].find((b) => b.textContent?.startsWith('+# to Dexterity'))!);
    await click($('.panel-pool .pick-row[data-modifier-id="mod.dexterity.t1"]'));
    await confirmNotice();

    expect(currentTexts().some((t) => t?.includes('Dexterity'))).toBe(true);
    expect(currentTexts().some((t) => t?.includes('Critical Hit Chance'))).toBe(false);
    expect(await sourceState()).toContain('Critical Hit Chance');
    expect(requirements()).toEqual(targetBefore);
    // The picker behaves as in v0.5.1: still open, the new modifier selected.
    expect($('.panel-pool .pick-row[data-modifier-id="mod.dexterity.t1"]').getAttribute('aria-pressed')).toBe('true');
    expect(historyRows()[0]!.textContent).toContain('замена мода');
  });

  it('"+ Add prefix" adds to a free slot by hand: manual step, no spending, undo / redo', async () => {
    await craft(1);
    const spentBefore = spentNote();
    const prefixesBefore = currentTexts().length;
    const addPrefix = button($('.panel-current'), 'Добавить префикс');
    await click(addPrefix);
    // Clicking the button inside the item is not a craft click.
    expect(historyRows()).toHaveLength(1);
    expect($('.panel-pool .mode-line-edit').textContent).toContain('Добавление мода в текущий предмет');
    expect($('.panel-pool [role="tab"][aria-selected="true"]').textContent).toContain('Префиксы');
    // Only what may go into a prefix slot of this item is offered.
    const offered = [...container.querySelectorAll<HTMLElement>('.panel-pool .pick-row.pick-allowed')];
    expect(offered.length).toBeGreaterThan(0);
    // The suffix tab offers nothing to pick: this add goes into a prefix slot.
    const suffixTab = [...container.querySelectorAll('.panel-pool [role="tab"]')].find((tb) => tb.textContent?.includes('Суффиксы'))!;
    expect(suffixTab.querySelector('.seg-meta')?.textContent).toBe('0');
    const pick = offered.find((r) => r.dataset.modifierId === 'mod.local-physical-percent.t1') ?? offered[0]!;
    const picked = pick.dataset.modifierId!;
    await click(pick);
    await confirmNotice();

    expect(currentTexts()).toHaveLength(prefixesBefore + 1);
    expect(historyRows()).toHaveLength(2);
    expect(historyRows()[0]!.className).toContain('history-manual');
    expect(historyRows()[0]!.textContent).toContain('добавление мода');
    expect(spentNote()).toBe(spentBefore);
    expect($(`.panel-pool .pick-row[data-modifier-id="${picked}"]`).getAttribute('aria-pressed')).toBe('true');

    await keyOn(window, 'z', { ctrlKey: true, code: 'KeyZ' });
    expect(currentTexts()).toHaveLength(prefixesBefore);
    await keyOn(window, 'y', { ctrlKey: true, code: 'KeyY' });
    expect(currentTexts()).toHaveLength(prefixesBefore + 1);
    expect(spentNote()).toBe(spentBefore);
  });

  it('the add button disappears when the side is full', async () => {
    const panel = $('.panel-current');
    for (let i = 0; i < 3; i++) {
      await click(button(panel, 'Добавить префикс'));
      await click($('.panel-pool .pick-row.pick-allowed'));
      await confirmNotice();
    }
    expect([...panel.querySelectorAll('button')].some((b) => b.textContent?.includes('Добавить префикс'))).toBe(false);
    expect([...panel.querySelectorAll('button')].some((b) => b.textContent?.includes('Добавить суффикс'))).toBe(true);
    expect($('.current-foot', panel).textContent).toContain('3 / 3');
  });
});

describe('navigation and target from the menu', () => {
  it('"show in pool" opens the modifier\'s side, family and tier', async () => {
    await rightClick(currentMod('Critical Hit Chance'));
    await choose('show-in-pool');
    const pool = $('.panel-pool');
    const selectedTab = [...pool.querySelectorAll('[role="tab"]')].find((t) => t.getAttribute('aria-selected') === 'true');
    expect(selectedTab?.textContent).toContain('Суффиксы');
    // The family is named by its own wording, not by its collision group ("Critical Hit Chance (local)").
    expect($('.family-item[aria-pressed="true"]', pool).textContent).toContain('+#% to Critical Hit Chance');
    expect($('tr.is-focus', pool).getAttribute('data-modifier-id')).toBe('mod.local-critical-chance.t1');
    expect(historyRows()).toHaveLength(0);
  });

  it('"add to target" never duplicates a family: it moves the minimum tier', async () => {
    const count = targetRows().length;
    await rightClick(currentMod('Critical Hit Chance'));
    expect(menuItem('add-to-target').getAttribute('aria-disabled')).toBe('true');
    expect(menuItem('add-to-target').textContent).toContain('уже в цели');
    await keyOn(document, 'Escape');

    await rightClick(currentMod('Critical Hit Chance'));
    await choose('tier');
    await choose('tier-mod.local-critical-chance.t3');
    await confirmNotice();
    await rightClick(currentMod('Critical Hit Chance'));
    expect(menuItem('add-to-target').textContent).toContain('мин. T3');
    await choose('add-to-target');
    expect(targetRows()).toHaveLength(count);
    expect(targetRow('Critical Hit Chance').querySelector('select')!.value).toBe('mod.local-critical-chance.t3');
  });
});

describe('source and target menus', () => {
  it('source operations stay setup: no history, no spending', async () => {
    await openSource();
    await rightClick(sourceChip('Critical Hit Chance'));
    expect(menuIds()).toEqual(['tier', 'replace', 'fracture', 'remove', 'show-in-pool']);
    await choose('tier');
    await choose('tier-mod.local-critical-chance.t2');
    expect(sourceChip('Critical Hit Chance').querySelector('select')!.value).toBe('mod.local-critical-chance.t2');
    await rightClick(sourceChip('Critical Hit Chance'));
    await choose('fracture');
    expect(sourceChip('Critical Hit Chance').className).not.toContain('mod-chip-fractured');
    expect(dialog()?.querySelector('.confirm-sheet')).toBeNull();
    await click(button($('.setup-surface .setup-actions'), 'Сохранить исходный'));
    expect(await sourceState()).toContain('mod.local-critical-chance.t2');
    expect(historyRows()).toHaveLength(0);
    expect(spentNote()).toContain('0 шагов');
    expect(container.querySelector('.spent-manual')).toBeNull();
  });

  it('target: change the minimum tier, require fractured, remove', async () => {
    const count = targetRows().length;
    await rightClick(targetRow('Projectile Skills'));
    expect(menuIds()).toEqual(['tier', 'fracture', 'show-in-pool', 'remove']);
    await choose('tier');
    await choose('tier-mod.projectile-skill-levels.t2');
    expect(targetRow('Projectile Skills').querySelector('select')!.value).toBe('mod.projectile-skill-levels.t2');

    await rightClick(targetRow('Projectile Skills'));
    expect(menuItem('fracture').textContent).toContain('Требовать Fractured');
    await choose('fracture');
    expect(targetRow('Projectile Skills').querySelector('.tag-fractured')).not.toBeNull();
    await rightClick(targetRow('Projectile Skills'));
    expect(menuItem('fracture').textContent).toContain('Не требовать Fractured');
    await choose('fracture');
    expect(targetRow('Projectile Skills').querySelector('.tag-fractured')).toBeNull();

    await rightClick(targetRow('Projectile Skills'));
    await choose('remove');
    expect(targetRows()).toHaveLength(count - 1);
    expect(historyRows()).toHaveLength(0);
  });
});
