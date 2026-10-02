import { describe, expect, it } from 'vitest';
import { createCraftDb, productionDataset, validateDataset } from '../index';

describe('production dataset', () => {
  it('constructs a valid production CraftDB without fixture sources or invented weights', () => {
    expect(validateDataset(productionDataset)).toEqual([]);
    const db = createCraftDb(productionDataset);
    expect(db.info.kind).toBe('production');
    expect(db.forVersion(db.supportedVersions[0]!).listBases().length).toBeGreaterThan(1000);
    expect(productionDataset.modifiers.every((m) => m.spawnWeights.every((w) => w.weight === null))).toBe(true);
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
