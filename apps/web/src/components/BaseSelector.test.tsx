// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { $, button, click, renderWorkspace, run, setField, type Mounted } from '@/test-utils';

let mounted: Mounted | undefined;
beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('fetch', vi.fn(async () => new Response('[]')));
});
afterEach(async () => {
  await mounted?.unmount();
  mounted = undefined;
  vi.unstubAllGlobals();
});

const dialog = () => $('.base-dialog');
const tile = (title: string) => [...dialog().querySelectorAll('.nav-tile')].find((t) => t.querySelector('.nav-tile-title')?.textContent === title)!;
const crumbs = () => [...dialog().querySelectorAll('.nav-crumbs li')].map((li) => li.textContent);

async function openCreate() {
  mounted = await renderWorkspace({ dataset: 'real' });
  await click(button($('.start-screen'), 'Create new item'));
  await click(button($('.setup-surface'), 'Choose base'));
}

describe('base selector on real data', () => {
  it('Body Armour → STR/INT → base creates the item; no internal record is ever shown', async () => {
    await openCreate();
    expect(dialog().textContent).not.toContain('[DNT]');
    expect([...dialog().querySelectorAll('.nav-section h3')].map((h) => h.textContent)).toEqual(['Armour', 'Jewellery', 'Weapons', 'Off-hand']);
    await click(tile('Body Armours'));
    expect(crumbs()).toEqual(['Item type', 'Body Armours']);
    expect(dialog().querySelectorAll('.nav-row')).toHaveLength(0);
    await click(tile('STR/INT'));
    expect(crumbs()).toEqual(['Item type', 'Body Armours', 'STR/INT']);
    const rows = [...dialog().querySelectorAll('.nav-row')];
    expect(rows.length).toBeGreaterThan(5);
    expect(dialog().textContent).not.toContain('[DNT]');
    const name = rows[0]!.querySelector('.nav-row-name')!.textContent!;
    await click(rows[0]!);
    expect($('.setup-surface .panel-source').textContent).toContain(name);
    await click(button($('.setup-surface .setup-actions'), 'Create item'));
    expect($('.panel-current').textContent).toContain(name);
  });

  it('Back, breadcrumb and Escape return step by step; the whole-catalog search shows context', async () => {
    await openCreate();
    await click(tile('One-handed weapons'));
    await click(tile('Spears'));
    expect(dialog().querySelector('[aria-label="Select Akoyan Spear"]')).not.toBeNull();
    await click(button(dialog(), 'Back'));
    expect(crumbs()).toEqual(['Item type', 'One-handed weapons']);
    await click(tile('Spears'));
    await click(button(dialog().querySelector('.nav-crumbs')!, 'Item type'));
    expect(crumbs()).toEqual(['Item type']);
    await click(tile('Rings'));
    await run(() => dialog().dispatchEvent(new Event('cancel', { cancelable: true })));
    expect(crumbs()).toEqual(['Item type']);
    await setField(dialog().querySelector<HTMLInputElement>('[name="base-search"]')!, 'topaz');
    const row = dialog().querySelector('[aria-label="Select Topaz Ring"]')!;
    expect(row.querySelector('.nav-row-context')!.textContent).toBe('Rings');
    await setField(dialog().querySelector<HTMLInputElement>('[name="base-search"]')!, 'Crystalline');
    expect(dialog().querySelectorAll('.nav-row')).toHaveLength(0);
  });
});
