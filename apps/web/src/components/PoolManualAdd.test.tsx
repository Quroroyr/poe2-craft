// @vitest-environment happy-dom
/**
 * Direct manual add from the normal (inspect) modifier pool. The row's status follows the held
 * tool's craft pool; the "+" follows the current item's manual-edit rules (`currentAddOptions`) —
 * two independent states. A "+" is a ManualEditStep: no currency, no roll, undo / redo.
 * Demo session: Akoyan Spear ilvl 82 with a fractured local critical chance T1 (a suffix).
 */
import { afterEach, describe, expect, it } from 'vitest';
import { createSession } from '@poe2-craft/craft-session';
import { SAMPLE_ITEMS, SAMPLE_TARGET_ITEMS } from '@poe2-craft/item-parser';
import { DEFAULT_GAME_VERSION, importSource, importTarget } from '@/lib/analyze';
import { $ as query, button, click, demoSession, keyOn, renderWorkspace, run, type Mounted } from '@/test-utils';

let mounted: Mounted;
afterEach(async () => {
  await mounted.unmount();
});
const mount = async (session = demoSession()) => {
  mounted = await renderWorkspace({ locale: 'en', session });
};
const root = () => mounted.container;
const $ = <T extends Element = HTMLElement>(selector: string) => query<T>(selector, root());
const pool = () => $('.panel-pool');
const tab = (name: 'Prefixes' | 'Suffixes') => click([...pool().querySelectorAll('[role="tab"]')].find((b) => b.textContent?.startsWith(name))!);
const family = (label: string) => click([...pool().querySelectorAll('.family-item')].find((b) => b.querySelector('.fam-label')?.textContent?.startsWith(label))!);
const row = (id: string) => $(`.panel-pool .pool-table tr[data-modifier-id="${id}"]`);
const addButton = (id: string) => row(id).querySelector<HTMLButtonElement>('.pool-add')!;
const addable = (id: string) => addButton(id).getAttribute('aria-disabled') === 'false';
const currentIds = () => [...root().querySelectorAll('.panel-current .current-mod .mod-text')].map((e) => e.textContent);
const history = () => [...root().querySelectorAll<HTMLElement>('.panel-history .history-row')];
const spent = () => $('.panel-spending .money-fact .money-note').textContent;
const confirmIfAsked = async () => {
  const sheet = root().querySelector('.confirm-dialog .confirm-sheet');
  if (sheet) await click(button(sheet, 'Got it'));
};
const heldTool = (title: string) => click($(`.panel-tools [aria-label="Tools"] [title^="${title}"]`));

describe('"+ Add" in the inspect pool', () => {
  it('an eligible row exposes Add to current; it adds by hand, asks once, keeps the pool in inspect mode', async () => {
    await mount();
    expect($('.active-craft').textContent).toContain('Exalted Orb');
    expect(pool().querySelector('.mode-line-edit')).toBeNull();
    await tab('Prefixes');
    await family('#% increased Physical Damage');
    const before = currentIds().length;
    const spentBefore = spent();
    expect(addable('mod.local-physical-percent.t1')).toBe(true);
    expect(addButton('mod.local-physical-percent.t1').title).toContain('manual edit');

    await click(addButton('mod.local-physical-percent.t1'));
    // The same one-time warning as every other manual edit: cancel changes nothing.
    await click(button($('.confirm-dialog .confirm-sheet'), 'Cancel'));
    expect(currentIds()).toHaveLength(before);
    await click(addButton('mod.local-physical-percent.t1'));
    await confirmIfAsked();

    expect(currentIds()).toHaveLength(before + 1);
    expect(currentIds().some((t) => t?.includes('increased Physical Damage'))).toBe(true);
    expect(history()).toHaveLength(1);
    expect(history()[0]!.className).toContain('history-manual');
    expect(history()[0]!.textContent).toContain('modifier added');
    expect(spent()).toBe(spentBefore);
    // Still inspecting with the held Exalted Orb, on the same tab and family.
    expect(pool().querySelector('.mode-line-edit')).toBeNull();
    expect($('.active-craft').textContent).toContain('Exalted Orb');
    expect(pool().querySelector('[role="tab"][aria-selected="true"]')!.textContent).toContain('Prefixes');
    expect(pool().querySelector('.family-item[aria-pressed="true"]')!.textContent).toContain('#% increased Physical Damage');
    // The family is now on the item: its other tiers are not swapped in silently.
    expect(addable('mod.local-physical-percent.t2')).toBe(false);
    expect(addButton('mod.local-physical-percent.t2').title).toContain('is already taken');
    expect(addButton('mod.local-physical-percent.t1').title).toContain('Already on the current item');

    // Undo / redo walk through it; no notice is asked again for a second add.
    await keyOn(window, 'z', { ctrlKey: true, code: 'KeyZ' });
    expect(currentIds()).toHaveLength(before);
    await keyOn(window, 'y', { ctrlKey: true, code: 'KeyY' });
    expect(currentIds()).toHaveLength(before + 1);
    await family('#% increased Physical Damage');
    await family('Adds # to # Fire Damage');
    await click(addButton('mod.local-flat-fire.t1'));
    expect(root().querySelector('.confirm-dialog .confirm-sheet')).toBeNull();
    expect(currentIds()).toHaveLength(before + 2);
    expect(spent()).toBe(spentBefore);
  });

  it('adds a suffix; a family already on the item (fractured crit) disables Add with its reason', async () => {
    await mount();
    await tab('Suffixes');
    await family('+# to Dexterity');
    await click(addButton('mod.dexterity.t1'));
    await confirmIfAsked();
    expect(currentIds().some((t) => t?.includes('Dexterity'))).toBe(true);
    await family('+# to Dexterity');
    await family('+#% to Critical Hit Chance');
    expect(addable('mod.local-critical-chance.t2')).toBe(false);
    expect(addButton('mod.local-critical-chance.t2').title).toMatch(/Cannot add by hand: .*already taken/);
  });

  it('the held Omen restricts the craft pool, not the manual add: a "blocked" suffix can still be added', async () => {
    await mount();
    await heldTool('Omen of Sinistral Exaltation');
    expect($('.active-craft').textContent).toContain('Sinistral');
    await tab('Suffixes');
    await family('+# to Dexterity');
    // Craft eligibility: the Omen makes the Exalted Orb add prefixes only.
    expect(row('mod.dexterity.t1').querySelector('.status')!.className).toContain('status-blocked');
    // Manual-add eligibility: the current item has free suffix slots.
    expect(addable('mod.dexterity.t1')).toBe(true);
    await click(addButton('mod.dexterity.t1'));
    await confirmIfAsked();
    expect(currentIds().some((t) => t?.includes('Dexterity'))).toBe(true);
    expect($('.active-craft').textContent).toContain('Sinistral');
  });

  it('a full side disables Add on that side only, even for rows the craft pool lists', async () => {
    await mount();
    await tab('Prefixes');
    for (const [fam, id] of [
      ['#% increased Physical Damage', 'mod.local-physical-percent.t1'],
      ['Adds # to # Fire Damage', 'mod.local-flat-fire.t1'],
      ['Adds # to # Cold Damage', 'mod.local-flat-cold.t1'],
    ] as const) {
      await family(fam);
      await click(addButton(id));
      await confirmIfAsked();
      await family(fam);
    }
    await family('Adds # to # Lightning Damage');
    expect(addable('mod.local-flat-lightning.t1')).toBe(false);
    expect(addButton('mod.local-flat-lightning.t1').title).toContain('no free slot: prefixes 3/3');
    await family('Adds # to # Lightning Damage');
    await tab('Suffixes');
    await family('+# to Dexterity');
    expect(addable('mod.dexterity.t1')).toBe(true);
  });

  it('item level: a tier above the item level cannot be added', async () => {
    const ilvl70 = SAMPLE_ITEMS.find((s) => s.id === 'ilvl-70')!.text;
    await mount(createSession({ gameVersion: DEFAULT_GAME_VERSION, seed: 1, source: importSource(ilvl70, DEFAULT_GAME_VERSION), target: importTarget(SAMPLE_TARGET_ITEMS[0]!.text, DEFAULT_GAME_VERSION) }));
    await tab('Prefixes');
    await run(() => {
      const status = pool().querySelector<HTMLSelectElement>('[name="pool-status"]')!;
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!.call(status, 'all');
      status.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await family('#% increased Physical Damage');
    expect(addable('mod.local-physical-percent.t1')).toBe(false); // needs ilvl 75
    expect(addButton('mod.local-physical-percent.t1').title).toContain('needs ilvl 75, the item has 70');
    expect(addable('mod.local-physical-percent.t2')).toBe(true);
  });

  it('right click on a tier offers Add to current item and Add to target', async () => {
    await mount();
    await tab('Prefixes');
    await family('#% increased Physical Damage');
    let notCancelled = true;
    await run(() => {
      notCancelled = row('mod.local-physical-percent.t1').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 30, clientY: 30 }));
    });
    expect(notCancelled).toBe(false);
    const ids = [...document.querySelectorAll<HTMLElement>('.ctx-menu [data-id]')].map((el) => el.dataset.id);
    expect(ids).toEqual(['add-to-current', 'add-to-target']);
    await click(document.querySelector('.ctx-menu [data-id="add-to-current"]')!);
    await confirmIfAsked();
    expect(currentIds().some((t) => t?.includes('increased Physical Damage'))).toBe(true);
    expect(history()[0]!.textContent).toContain('modifier added');
  });
});
