import { describe, expect, it } from 'vitest';
import { akoyanSpearFixture, createCraftDb } from '@poe2-craft/craft-db';
import {
  createItemState,
  targetSpecFromItem,
  type ExplicitModifier,
  type ItemState,
  type TargetSpec,
} from '@poe2-craft/craft-domain';
import { compareToTarget, familyTiers, outstandingTargetModifiers, targetFromModifier } from './index';

const view = createCraftDb(akoyanSpearFixture).forVersion('0.5.0');

const mod = (modifierId: string): ExplicitModifier => ({
  kind: 'resolved',
  modifierId,
  values: [],
  fractured: false,
  sourceText: modifierId,
});

const spear = (explicits: ExplicitModifier[]): ItemState =>
  createItemState({
    baseId: 'base.akoyan-spear',
    baseName: 'Akoyan Spear',
    itemClassName: 'Spears',
    rarity: 'rare',
    itemLevel: 82,
    explicits,
    otherLines: [],
    corrupted: false,
  });

const target = (...modifierIds: string[]): TargetSpec => targetSpecFromItem(spear(modifierIds.map(mod)));

const TARGET = target(
  'mod.local-physical-percent.t1',
  'mod.local-flat-lightning.t1',
  'mod.local-critical-chance.t1',
  'mod.projectile-skill-levels.t1',
);

describe('current vs target comparison', () => {
  it('counts matches and lists missing and extra modifiers', () => {
    const current = spear([
      mod('mod.local-physical-percent.t1'),
      mod('mod.local-critical-chance.t1'),
      mod('mod.local-attack-speed.t1'),
    ]);
    const result = compareToTarget(current, TARGET, view);
    expect(result.matched).toBe(2);
    expect(result.total).toBe(4);
    expect(result.rows.map((r) => r.status)).toEqual(['matched', 'missing', 'matched', 'missing']);
    expect(result.extra.map((m) => m.kind === 'resolved' && m.modifierId)).toEqual(['mod.local-attack-speed.t1']);
    expect(result.sameBase).toBe(true);
    expect(outstandingTargetModifiers(result).map((d) => d.id)).toEqual([
      'mod.local-flat-lightning.t1',
      'mod.projectile-skill-levels.t1',
    ]);
  });

  it('treats a requirement as a minimum tier', () => {
    const current = spear([mod('mod.local-physical-percent.t3'), mod('mod.projectile-skill-levels.t1')]);
    const result = compareToTarget(
      current,
      target('mod.local-physical-percent.t1', 'mod.projectile-skill-levels.t2'),
      view,
    );
    expect(result.rows.map((r) => r.status)).toEqual(['worse-tier', 'better-tier']);
    expect(result.matched).toBe(1);
  });

  it('marks requirements unknown to the game version', () => {
    const spec: TargetSpec = { ...TARGET, requirements: [{ id: 'r1', modifierId: 'mod.gone', fractured: false, origin: 'manual' }] };
    expect(compareToTarget(spear([]), spec, view).rows[0]?.status).toBe('unknown');
  });

  it('keeps unrecognised lines of an imported example as text, not as requirements', () => {
    const imported = targetSpecFromItem(
      spear([
        mod('mod.dexterity.t1'),
        { kind: 'unresolved', sourceText: '+1 to Something', fractured: false, reason: 'no-matching-definition' },
      ]),
    );
    expect(imported.requirements.map((r) => r.modifierId)).toEqual(['mod.dexterity.t1']);
    expect(imported.unresolvedLines).toEqual(['+1 to Something']);
  });
});

describe('stage target from a modifier', () => {
  it('accepts that tier or better', () => {
    expect(targetFromModifier(view, 'mod.projectile-skill-levels.t1')?.modifierIds).toEqual([
      'mod.projectile-skill-levels.t1',
    ]);
    expect(targetFromModifier(view, 'mod.projectile-skill-levels.t2')?.modifierIds).toEqual([
      'mod.projectile-skill-levels.t1',
      'mod.projectile-skill-levels.t2',
    ]);
    expect(targetFromModifier(view, 'mod.unknown')).toBeNull();
  });

  it('does not mix a hybrid with the single-group family', () => {
    const ids = targetFromModifier(view, 'mod.local-critical-chance.t2')?.modifierIds ?? [];
    expect(ids).not.toContain('mod.local-critical-hybrid.t1');
  });

  it('lists family tiers best first', () => {
    const def = view.getModifier('mod.projectile-skill-levels.t3')!;
    expect(familyTiers(view, def).map((d) => d.tier)).toEqual([1, 2, 3, 4]);
  });
});
