import { describe, expect, it } from 'vitest';
import { akoyanSpearFixture, createCraftDb } from '@poe2-craft/craft-db';
import { createItemState, type ExplicitModifier, type ItemState } from '@poe2-craft/craft-domain';
import { compareToTarget, outstandingTargetModifiers, targetFromModifier } from './index';

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

const TARGET = spear([
  mod('mod.local-physical-percent.t1'),
  mod('mod.local-flat-lightning.t1'),
  mod('mod.local-critical-chance.t1'),
  mod('mod.projectile-skill-levels.t1'),
]);

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

  it('distinguishes better and worse tiers of the same group', () => {
    const current = spear([mod('mod.local-physical-percent.t3'), mod('mod.projectile-skill-levels.t1')]);
    const target = spear([mod('mod.local-physical-percent.t1'), mod('mod.projectile-skill-levels.t2')]);
    const result = compareToTarget(current, target, view);
    expect(result.rows.map((r) => r.status)).toEqual(['worse-tier', 'better-tier']);
    expect(result.matched).toBe(1);
  });

  it('marks unrecognised target lines as unknown', () => {
    const target = spear([
      { kind: 'unresolved', sourceText: '+1 to Something', fractured: false, reason: 'no-matching-definition' },
    ]);
    const result = compareToTarget(spear([]), target, view);
    expect(result.rows[0]?.status).toBe('unknown');
    expect(result.matched).toBe(0);
  });
});

describe('stage target from a target modifier', () => {
  it('accepts that tier or better', () => {
    expect(targetFromModifier(view, 'mod.projectile-skill-levels.t1')?.modifierIds).toEqual([
      'mod.projectile-skill-levels.t1',
    ]);
    expect(targetFromModifier(view, 'mod.projectile-skill-levels.t2')?.modifierIds).toEqual([
      'mod.projectile-skill-levels.t2',
      'mod.projectile-skill-levels.t1',
    ]);
    expect(targetFromModifier(view, 'mod.unknown')).toBeNull();
  });

  it('does not mix a hybrid with the single-group modifier', () => {
    const ids = targetFromModifier(view, 'mod.local-critical-chance.t2')?.modifierIds ?? [];
    expect(ids).not.toContain('mod.local-critical-hybrid.t1');
  });
});
