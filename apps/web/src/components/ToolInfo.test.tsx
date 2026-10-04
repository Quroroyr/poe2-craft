// @vitest-environment happy-dom
/**
 * Right click on a palette tool: what it does, from the stored descriptions — never a selection.
 * Real data (production dataset), a rare ring pasted as the current item.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { $, button, click, keyOn, paste, renderWorkspace, run, type Mounted } from '@/test-utils';

const RING = 'Item Class: Rings\nRarity: Rare\nTest Item\nTopaz Ring\n--------\nItem Level: 82\n--------\n+25% to Lightning Resistance (implicit)\n--------\n+21 to maximum Life\n+15% to Fire Resistance';

let mounted: Mounted;
let root: HTMLDivElement;
beforeEach(async () => {
  localStorage.clear();
  vi.stubGlobal('fetch', vi.fn(async (url: string) => new Response(JSON.stringify(url === '/api/prices' ? [{ id: 'Test', name: 'Test' }] : { id: 'live', source: 'poe.ninja', league: 'Test', capturedAt: '2026-10-02T00:00:00Z', unit: 'div', prices: {} }))));
  mounted = await renderWorkspace({ dataset: 'real', locale: 'en' });
  root = mounted.container;
  await paste(RING);
  await click(button($('.preview-dialog', root), 'Start crafting'));
});
afterEach(async () => {
  await mounted.unmount();
  vi.unstubAllGlobals();
});

const tile = (name: string) => {
  const found = [...root.querySelectorAll<HTMLElement>('.tool-tile')].find((b) => b.querySelector('.tool-name')?.textContent === name.replace(/^Omen of /, ''));
  if (!found) throw new Error(`no tool "${name}"`);
  return found;
};
const rightClick = async (el: Element) => {
  let notCancelled = true;
  await run(() => {
    notCancelled = el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 50, clientY: 60 }));
  });
  return notCancelled;
};
const popup = () => document.querySelector<HTMLElement>('.tool-info');
const held = () => $('.active-craft', root).textContent ?? '';

describe('tool info on right click', () => {
  it('opens for a modelled currency instead of the browser menu, and does not select it', async () => {
    const heldBefore = held();
    const selectedBefore = tile('Exalted Orb').getAttribute('aria-selected');
    expect(await rightClick(tile('Exalted Orb'))).toBe(false);
    const info = popup()!;
    expect(info.getAttribute('role')).toBe('dialog');
    expect(info.textContent).toContain('Exalted Orb');
    expect(info.textContent).toContain('Modelled');
    expect(info.textContent).toContain('Augments a Rare item with a new random modifier.');
    expect(info.querySelector('.tool-info-facts')!.textContent).not.toMatch(/Pinned|Right click this item/);
    expect(info.textContent).toContain('Rare · Uncorrupted');
    expect(info.textContent).toContain('Applicable');
    expect(info.querySelector('.tool-info-source')!.textContent).toContain('RePoE client 4.5.5.2');
    expect(held()).toBe(heldBefore);
    expect(tile('Exalted Orb').getAttribute('aria-selected')).toBe(selectedBefore);
  });

  it('says why a currency does not apply to the current item', async () => {
    await rightClick(tile('Orb of Transmutation'));
    expect(popup()!.textContent).toContain('Not applicable: wrong rarity');
  });

  it('Chaos and Divine show their own effects', async () => {
    await rightClick(tile('Chaos Orb'));
    expect(popup()!.textContent).toContain('Removes a random modifier and augments a Rare item');
    await rightClick(tile('Divine Orb'));
    expect(popup()!.textContent).toContain('Randomises the numeric values of modifiers');
  });

  it('an omen: effect, the currency it works with, its change in plain words', async () => {
    await rightClick(tile('Omen of Sinistral Exaltation'));
    const text = popup()!.textContent;
    expect(text).toContain('your next Exalted Orb will add only prefix modifiers');
    expect(text).toContain('Works with');
    expect(text).toContain('Exalted Orb');
    expect(text).toContain('Restricts added modifiers to Prefixes.');
    expect(held()).not.toContain('Sinistral');
    await rightClick(tile('Omen of Whittling'));
    expect(popup()!.textContent).toContain('Chaos Orb will remove the lowest level modifier');
  });

  it('an unmodelled tool says "Not modelled yet" and invents no mechanic', async () => {
    await click(button(root, 'All'));
    const unmodelled = [...root.querySelectorAll<HTMLElement>('.tool-tile.tool-tile-dim')].find((b) => b.querySelector('.tool-flag')?.textContent === 'not modelled')!;
    await rightClick(unmodelled);
    const text = popup()!.textContent;
    expect(text).toContain('Not modelled yet');
    expect(text).toContain('No description in the data yet.');
    expect(text).not.toContain('Requirements');
  });

  it('Escape, a click outside and a second right click close it', async () => {
    await rightClick(tile('Exalted Orb'));
    await keyOn(document, 'Escape');
    expect(popup()).toBeNull();

    await rightClick(tile('Exalted Orb'));
    await run(() => document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
    expect(popup()).toBeNull();

    await rightClick(tile('Exalted Orb'));
    await run(() => tile('Exalted Orb').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 2 })));
    await rightClick(tile('Exalted Orb'));
    expect(popup()).toBeNull();
  });

  it('Shift+F10 and the menu key on a focused tile open the same info', async () => {
    await keyOn(tile('Exalted Orb'), 'F10', { shiftKey: true });
    expect(popup()!.textContent).toContain('Augments a Rare item');
    await keyOn(document, 'Escape');
    await keyOn(tile('Chaos Orb'), 'ContextMenu');
    expect(popup()!.textContent).toContain('Chaos Orb');
  });

  it('a left click still selects the tool', async () => {
    await click(tile('Chaos Orb'));
    expect(held()).toContain('Chaos Orb');
  });
});
