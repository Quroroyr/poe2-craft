import { describe, expect, it } from 'vitest';
import {
  compareGameVersions,
  isAvailableIn,
  rangesOverlap,
} from '@poe2-craft/craft-domain';
import {
  InvalidDatasetError,
  UnsupportedGameVersionError,
  akoyanSpearFixture,
  createCraftDb,
  validateDataset,
} from './index';

const db = createCraftDb(akoyanSpearFixture);
const ids = (mods: readonly { id: string }[]) => mods.map((m) => m.id);

describe('game versions', () => {
  it('compares numerically, not lexically', () => {
    expect(compareGameVersions('0.10.0', '0.9.0')).toBe(1);
    expect(compareGameVersions('0.5.0', '0.5.0')).toBe(0);
  });

  it('treats removedIn as exclusive', () => {
    const range = { introducedIn: '0.4.0', removedIn: '0.5.0' };
    expect(isAvailableIn(range, '0.4.0')).toBe(true);
    expect(isAvailableIn(range, '0.5.0')).toBe(false);
    expect(rangesOverlap(range, { introducedIn: '0.5.0' })).toBe(false);
  });
});

describe('craft db', () => {
  it('fixture dataset is valid and labelled as fixture', () => {
    expect(validateDataset(akoyanSpearFixture)).toEqual([]);
    expect(db.info.kind).toBe('fixture');
    expect(db.info.sources.some((s) => s.kind === 'fixture')).toBe(true);
  });

  it('filters by game version', () => {
    const v4 = ids(db.forVersion('0.4.0').listModifiers());
    const v5 = ids(db.forVersion('0.5.0').listModifiers());
    expect(v4).toContain('mod.stun-duration.t1');
    expect(v5).not.toContain('mod.stun-duration.t1');
    expect(v4).not.toContain('mod.fixture-future-stat.t1');
    expect(v5).not.toContain('mod.fixture-future-stat.t1');
  });

  it('returns the revision of a stable id that is live in the version', () => {
    const weight = (version: string) =>
      db.forVersion(version).getModifier('mod.local-attack-speed.t1')?.spawnWeights[0]?.weight;
    expect(weight('0.4.0')).toBe(600);
    expect(weight('0.5.0')).toBe(400);
  });

  it('rejects versions the dataset does not cover', () => {
    expect(() => db.forVersion('0.6.0')).toThrow(UnsupportedGameVersionError);
  });

  it('filters by item class through base spawn tags', () => {
    const view = db.forVersion('0.5.0');
    const spear = ids(view.listModifiers({ baseId: 'base.akoyan-spear' }));
    const bow = ids(view.listModifiers({ baseId: 'base.recurve-bow' }));
    expect(spear).not.toContain('mod.arrow-speed.t1');
    expect(bow).toContain('mod.arrow-speed.t1');
    expect(bow).not.toContain('mod.melee-skill-levels.t1');
    expect(spear).toContain('mod.melee-skill-levels.t1');
  });

  it('filters by item level', () => {
    const view = db.forVersion('0.5.0');
    const at70 = ids(view.listModifiers({ baseId: 'base.akoyan-spear', maxItemLevel: 70 }));
    expect(at70).not.toContain('mod.projectile-skill-levels.t1'); // requires 81
    expect(at70).toContain('mod.projectile-skill-levels.t2'); // requires 55
  });

  it('refuses broken references', () => {
    const broken = {
      ...akoyanSpearFixture,
      targets: [{ ...akoyanSpearFixture.targets[0]!, modifierIds: ['mod.does-not-exist'] }],
    };
    expect(() => createCraftDb(broken)).toThrow(InvalidDatasetError);
  });

  it('refuses overlapping revisions of one id', () => {
    const mod = akoyanSpearFixture.modifiers[0]!;
    const broken = { ...akoyanSpearFixture, modifiers: [...akoyanSpearFixture.modifiers, mod] };
    expect(validateDataset(broken).some((p) => p.includes('overlapping'))).toBe(true);
  });
});
