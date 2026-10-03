import { describe, expect, it } from 'vitest';
import { akoyanSpearFixture, createCraftDb, productionDataset } from '@poe2-craft/craft-db';
import { NAV_ROOT, basesAt, buildBaseNavigation, locateBase, parentPath, searchOffered } from './base-navigation';

const view = createCraftDb(productionDataset).forVersion('0.5.5');
const nav = buildBaseNavigation(view);
const cls = (id: string) => nav.categories.flatMap((c) => c.classes).find((c) => c.itemClass.id === id)!;
const named = (name: string) => view.listBases().find((b) => b.name === name && !b.ambiguousName)!;

describe('base navigation over real data', () => {
  it('offers only player-facing bases of craftable classes', () => {
    expect(nav.bases.some((b) => b.name.startsWith('['))).toBe(false);
    expect(nav.bases.some((b) => /Unique/.test(b.id.split('/').pop()!))).toBe(false);
    expect(nav.bases.every((b) => b.dataStatus === 'crafting-supported')).toBe(true);
    expect(nav.bases.length).toBeLessThan(view.listBases().length);
    expect(searchOffered(nav, 'DNT')).toEqual([]);
    expect(searchOffered(nav, 'Crystalline Dagger')).toEqual([]);
  });

  it('groups classes into armour, jewellery, one-/two-handed weapons and off-hand from the data', () => {
    const where = Object.fromEntries(nav.categories.flatMap((c) => c.classes.map((x) => [x.itemClass.id, c.id])));
    expect(where).toMatchObject({
      'Body Armour': 'armour', Helmet: 'armour', Gloves: 'armour', Boots: 'armour',
      Ring: 'jewellery', Amulet: 'jewellery', Belt: 'jewellery',
      Spear: 'one-handed', Wand: 'one-handed', Bow: 'two-handed', Crossbow: 'two-handed', Warstaff: 'two-handed',
      Shield: 'offhand', Focus: 'offhand', Quiver: 'offhand',
    });
    expect(where.Jewel).toBeUndefined();
    expect(where.LifeFlask).toBeUndefined();
  });

  it('splits defence classes by archetype and lists bases by level', () => {
    const body = cls('Body Armour');
    expect(body.groups?.map((g) => g.id)).toEqual(expect.arrayContaining(['str', 'dex', 'int', 'str_dex', 'str_int', 'dex_int']));
    const strInt = basesAt(nav, { category: 'armour', classId: 'Body Armour', group: 'str_int' })!;
    expect(strInt.length).toBeGreaterThan(5);
    expect(strInt.every((b) => b.tags.includes('str_int_armour'))).toBe(true);
    const levels = strInt.map((b) => b.dropLevel ?? 0);
    expect(levels).toEqual([...levels].sort((a, b) => a - b));
    expect(cls('Ring').groups).toBeNull();
    expect(cls('Spear').groups).toBeNull();
    expect(cls('Focus').groups).toBeNull();
  });

  it('finds the golden bases in two or three steps', () => {
    expect(locateBase(nav, named('Rusted Cuirass').id)).toMatchObject({ category: 'armour', group: 'str' });
    expect(locateBase(nav, named('Topaz Ring').id)).toMatchObject({ category: 'jewellery', group: null, itemClass: { id: 'Ring' } });
    expect(locateBase(nav, named('Akoyan Spear').id)).toMatchObject({ category: 'one-handed', group: null, itemClass: { id: 'Spear' } });
    expect(basesAt(nav, { category: 'jewellery', classId: 'Ring', group: null })!.some((b) => b.name === 'Topaz Ring')).toBe(true);
    expect(basesAt(nav, { category: 'armour', classId: 'Body Armour', group: null })).toBeNull();
  });

  it('steps back over skipped levels', () => {
    expect(parentPath(nav, { category: 'armour', classId: 'Body Armour', group: 'str_int' })).toEqual({ category: 'armour', classId: 'Body Armour', group: null });
    expect(parentPath(nav, { category: 'armour', classId: 'Body Armour', group: null })).toEqual(NAV_ROOT);
    expect(parentPath(nav, { category: 'jewellery', classId: 'Ring', group: null })).toEqual(NAV_ROOT);
    expect(parentPath(nav, { category: 'one-handed', classId: 'Spear', group: null })).toEqual({ ...NAV_ROOT, category: 'one-handed' });
    expect(parentPath(nav, { ...NAV_ROOT, category: 'one-handed' })).toEqual(NAV_ROOT);
  });

  it('searches inside a group and over all offered bases', () => {
    const strInt = basesAt(nav, { category: 'armour', classId: 'Body Armour', group: 'str_int' })!;
    const name = strInt[0]!.name.split(' ')[0]!;
    expect(searchOffered(nav, name, strInt).every((b) => strInt.includes(b))).toBe(true);
    expect(searchOffered(nav, 'topaz').map((b) => b.name)).toContain('Topaz Ring');
  });

  it('works on the demo catalog too', () => {
    const demo = buildBaseNavigation(createCraftDb(akoyanSpearFixture).forVersion('0.5.0'));
    expect(demo.categories.map((c) => c.id)).toEqual(['one-handed', 'two-handed']);
    expect(demo.bases).toHaveLength(13);
  });
});
