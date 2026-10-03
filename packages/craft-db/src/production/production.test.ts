import { describe, expect, it } from 'vitest';
import { PRODUCTION_WEIGHTS, assignWeightTables, createCraftDb, productionDataset, validateDataset } from '../index';

describe('production dataset', () => {
  it('constructs a valid production CraftDB without fixture sources or invented weights', () => {
    expect(validateDataset(productionDataset)).toEqual([]);
    const db = createCraftDb(productionDataset);
    expect(db.info.kind).toBe('production');
    expect(db.forVersion(db.supportedVersions[0]!).listBases().length).toBeGreaterThan(1000);
    // Client spawn entries carry no numbers; every number is in a PoE2DB community weight table.
    expect(productionDataset.modifiers.every((m) => m.spawnWeights.every((w) => w.weight === null))).toBe(true);
    const tables = productionDataset.weightTables ?? [];
    expect(tables.reduce((sum, t) => sum + t.entries.length, 0)).toBeGreaterThan(5000);
    expect(tables.every((t) => t.evidence.sourceId === 'poe2db-weightings' && t.evidence.confidence === 'community' &&
      t.evidence.method === 'recombinator-observation' && t.evidence.patch === '0.5.5' && t.entries.every((e) => e.weight > 1))).toBe(true);
    expect(productionDataset.bases.filter((b) => b.weightTableId).length).toBeGreaterThan(1500);
  });

  it('rejects broken weight tables', () => {
    const table = productionDataset.weightTables![0]!;
    const base = productionDataset.bases.find((b) => b.weightTableId === table.id)!;
    const other = productionDataset.weightTables!.find((t) => t.itemClassId !== table.itemClassId)!;
    const forbidden = productionDataset.modifiers.find((m) => !m.spawnWeights.some((w) => w.spawns && base.tags.includes(w.tag)))!;
    const entry = table.entries[0]!;
    const broken = (changes: Partial<typeof table>, bases = productionDataset.bases) =>
      validateDataset({ ...productionDataset, bases, weightTables: [{ ...table, ...changes }, ...productionDataset.weightTables!.slice(1)] }).join('\n');
    expect(broken({ entries: [{ ...entry, weight: 0 }] })).toContain('invalid weight');
    expect(broken({ entries: [entry, entry] })).toContain('duplicate weight');
    expect(broken({ entries: [{ ...entry, modifierId: 'Missing1' }] })).toContain('unknown modifier');
    expect(broken({ unmeasured: [entry.modifierId] })).toContain('both weighted and unmeasured');
    expect(broken({ evidence: { ...table.evidence, method: 'fixture' } })).toContain('invalid production weight evidence');
    expect(broken({ entries: [{ modifierId: forbidden.id, weight: 500 }] }, productionDataset.bases.filter((b) => b.weightTableId !== table.id || b.id === base.id))).toContain('cannot spawn on any base');
    expect(validateDataset({ ...productionDataset, bases: [{ ...base, weightTableId: other.id }] }).join('\n')).toContain('is for class');
  });

  it('keeps the weights snapshot clean: no conflicts, one table per base, patch matches the dataset', () => {
    expect(PRODUCTION_WEIGHTS.conflicts).toEqual([]);
    expect(PRODUCTION_WEIGHTS.gameVersion).toBe(productionDataset.info.gameVersions[0]);
    expect(PRODUCTION_WEIGHTS.gamePatch?.startsWith(PRODUCTION_WEIGHTS.gameVersion)).toBe(true);
    expect(PRODUCTION_WEIGHTS.tables.every((t) => t.entries.every((e) => e.weight > PRODUCTION_WEIGHTS.placeholderMax))).toBe(true);
    expect(() => assignWeightTables(productionDataset.bases, { ...PRODUCTION_WEIGHTS, tables: [PRODUCTION_WEIGHTS.tables[0]!, PRODUCTION_WEIGHTS.tables[0]!] })).toThrow('two tables');
  });

  it.each([
    ['side', { side: 'implicit' }, 'invalid side'],
    ['layer', { layer: 'corruption' }, 'invalid layer'],
    ['tier', { tier: 0 }, 'invalid tier'],
    ['group', { groupIds: ['missing'] }, 'unknown group'],
    ['weight', { spawnWeights: [{ tag: 'default', weight: 1 }] }, 'needs evidence'],
    ['fixture', { provenance: { sourceId: 'fixture', confidence: 'experimental' } }, 'fixture source'],
  ])('rejects invalid %s data', (_name, change, message) => {
    const broken = {
      ...productionDataset,
      info: { ...productionDataset.info, sources: [...productionDataset.info.sources, { id: 'fixture', title: 'Fixture', kind: 'fixture' as const }] },
      modifiers: [{ ...productionDataset.modifiers[0]!, ...change }],
    } as typeof productionDataset;
    expect(validateDataset(broken).join('\n')).toContain(message);
  });

  it('rejects broken implicit references, duplicate revisions and unsupported modelled claims', () => {
    const problems = validateDataset({ ...productionDataset,
      bases: [{ ...productionDataset.bases[0]!, implicitModifierIds: ['missing'] }],
      modifiers: [productionDataset.modifiers[0]!, productionDataset.modifiers[0]!],
      consumables: [{ ...productionDataset.consumables[0]!, craftStatus: 'modelled' }],
      actions: [],
    }).join('\n');
    expect(problems).toContain('unknown implicit');
    expect(problems).toContain('overlapping');
    expect(problems).toContain('action that spends');
  });
});
