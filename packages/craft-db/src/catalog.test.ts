import { describe, expect, it } from 'vitest';
import { baseVisibility, catalogCounts, defenceArchetype, productionDataset } from './index';

const base = (over: Record<string, unknown>) => ({
  id: 'Metadata/Items/Armours/BodyArmours/FourBodyStr1', name: 'Rusted Cuirass', dataStatus: 'validated' as const,
  tags: ['str_armour', 'body_armour', 'armour', 'default'], details: { properties: [{ name: 'Armour', value: '45' }], requirements: {}, implicits: [], provenance: { sourceId: 's', confidence: 'verified' as const } },
  ...over,
});

describe('base visibility', () => {
  it('hides developer records by their bracketed marker, not by one exact prefix', () => {
    expect(baseVisibility(base({ name: '[DNT] Crystalline Dagger' }))).toEqual({ visibility: 'test', reason: 'dev-marker' });
    expect(baseVisibility(base({ name: '[UNUSED] Anything' })).visibility).toBe('test');
    expect(baseVisibility(base({ name: 'Rusted Cuirass [2]' })).visibility).toBe('player-facing');
  });
  it('separates unique-only records and bases the official trade does not list', () => {
    expect(baseVisibility(base({ id: 'Metadata/Items/Amulets/FourAmuletUnique1VerisiumUnique2' }))).toEqual({ visibility: 'internal', reason: 'unique-only-record' });
    expect(baseVisibility(base({ dataStatus: 'imported' }))).toEqual({ visibility: 'unknown', reason: 'not-in-official-trade' });
    expect(baseVisibility(base({}))).toEqual({ visibility: 'player-facing', reason: 'listed' });
    expect(baseVisibility(base({ dataStatus: undefined }))).toEqual({ visibility: 'player-facing', reason: 'hand-written' });
  });
  it('counts the production catalog: every [DNT] record hidden, the rest classified', () => {
    const counts = catalogCounts(productionDataset.bases);
    const dnt = productionDataset.bases.filter((b) => b.name.startsWith('[DNT]')).length;
    expect(dnt).toBeGreaterThan(0);
    expect(counts.byReason['dev-marker']).toBe(dnt);
    expect(counts.byVisibility['player-facing'] + counts.byVisibility.test + counts.byVisibility.internal + counts.byVisibility.unknown).toBe(counts.total);
    expect(counts.byVisibility['player-facing']).toBeGreaterThan(1000);
  });
});

describe('defence archetype', () => {
  const props = (...names: string[]) => ({ ...base({}).details, properties: names.map((name) => ({ name, value: '10' })) });
  it('comes from defence properties checked against the attribute tag', () => {
    expect(defenceArchetype(base({}))).toEqual({ archetype: 'str', fromProperties: 'str', fromTag: 'str' });
    expect(defenceArchetype(base({ tags: ['str_int_armour'], details: props('Armour', 'Energy Shield') })).archetype).toBe('str_int');
    expect(defenceArchetype(base({ tags: ['dex_int_armour'], details: props('Evasion Rating', 'Energy Shield') })).archetype).toBe('dex_int');
  });
  it('uses the one source that exists, and marks a disagreement as special', () => {
    expect(defenceArchetype(base({ tags: ['helmet'], details: props('Energy Shield') })).archetype).toBe('int');
    expect(defenceArchetype(base({ tags: ['str_dex_int_armour'], details: props() })).archetype).toBe('str_dex_int');
    expect(defenceArchetype(base({ tags: ['str_dex_int_armour'], details: props('Armour', 'Evasion Rating') })).archetype).toBe('special');
    expect(defenceArchetype(base({ tags: ['ring'], details: props() })).archetype).toBeNull();
  });
  it('ignores zero defences', () => {
    expect(defenceArchetype(base({ tags: [], details: { ...props(), properties: [{ name: 'Armour', value: '0' }, { name: 'Evasion Rating', value: '12' }] } })).archetype).toBe('dex');
  });
});
