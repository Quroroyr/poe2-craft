import { describe, expect, it } from 'vitest';
import { akoyanSpearFixture, createCraftDb, productionDataset } from '@poe2-craft/craft-db';
import { createItemFromBase, toolInfo, toolPalette } from './index';

const db = createCraftDb(productionDataset);
const view = db.forVersion(db.supportedVersions[0]!);
const palette = toolPalette(view);
const byName = (name: string) => view.listConsumables().find((c) => c.name === name)!;
const rare = () => {
  const base = view.findBaseByName('Akoyan Spear')!;
  const item = createItemFromBase(view, base.id, 82)!;
  return { ...item, rarity: 'rare' as const };
};
const info = (name: string, item = rare()) => toolInfo(view, palette, byName(name), item);

describe('tool info (palette right click)', () => {
  it('a modelled currency: readable effect, requirements, applicability; the source is kept apart', () => {
    const exalted = info('Exalted Orb');
    expect(exalted.status).toBe('modelled');
    expect(exalted.effect).toBe('Augments a Rare item with a new random modifier. Rare items can have up to six random modifiers.');
    expect(exalted.effect).not.toMatch(/Pinned|RePoE|Right click|\[/);
    expect(exalted.descriptionSource).toBe('RePoE client 4.5.5.2 · base_items.json');
    expect(exalted.modelNote).toMatch(/community model/);
    expect(exalted.requirements).toMatchObject({ rarities: ['rare'], uncorrupted: true });
    expect(exalted.block).toBeNull();
    expect(exalted.provenance.sourceId).toBe('official-trade2');
  });

  it('says why a currency does not apply to the current item', () => {
    expect(info('Orb of Transmutation').block).toBe('rarity');
    expect(info('Fracturing Orb').block).toBe('too-few-modifiers');
    expect(info('Chaos Orb').effect).toBe('Removes a random modifier and augments a Rare item with a new random modifier.');
    expect(info('Divine Orb').effect).toBe('Randomises the numeric values of modifiers on an item.');
  });

  it('an omen: effect, the currency it works with and its modifiers as data', () => {
    const sinistral = info('Omen of Sinistral Exaltation');
    expect(sinistral.effect).toBe('While this item is active in your inventory your next Exalted Orb will add only prefix modifiers.');
    expect(sinistral.worksWith.map((c) => c.name)).toEqual(['Exalted Orb']);
    expect(sinistral.actionModifiers).toEqual([{ kind: 'restrict-side', operation: 'add', side: 'prefix' }]);
    expect(sinistral.requirements).toBeNull();
    expect('block' in sinistral).toBe(false);
    expect(info('Omen of Whittling').worksWith.map((c) => c.name)).toEqual(['Chaos Orb']);
  });

  it('a catalogued tool is "not modelled" and invents no mechanic', () => {
    const unmodelled = view.listConsumables().find((c) => !palette.modelled.has(c.id))!;
    const result = toolInfo(view, palette, unmodelled, rare());
    expect(result.status).toBe('catalogued');
    expect(result.effect).toBeNull();
    expect(result.requirements).toBeNull();
    expect('block' in result).toBe(false);
  });

  it('demo data: the effect comes from the action description', () => {
    const demo = createCraftDb(akoyanSpearFixture).forVersion('0.5.0');
    const exalted = demo.listConsumables().find((c) => c.id === 'currency.exalted-orb')!;
    expect(toolInfo(demo, toolPalette(demo), exalted, null)).toMatchObject({ effect: 'Adds one random prefix or suffix, weighted by spawn weight.', block: 'no-item' });
  });
});
