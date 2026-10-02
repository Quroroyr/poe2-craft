/**
 * Picking a tier in the pool while editing: what a click does is decided from the real source /
 * target — add, swap the tier of a family already there, or nothing (selected / unavailable).
 */
import { describe, expect, it } from 'vitest';
import { akoyanSpearFixture, createCraftDb } from '@poe2-craft/craft-db';
import { createItemState, targetSpecFromItem, type ExplicitModifier, type ItemState } from '@poe2-craft/craft-domain';
import { applySourcePick, applyTargetPick, isPickSelected, sourcePickOptions, targetPickOptions } from './index';

const db = createCraftDb(akoyanSpearFixture);
const VERSION = '0.5.0';

const resolved = (modifierId: string, fractured = false): ExplicitModifier => ({
  kind: 'resolved',
  modifierId,
  values: [],
  fractured,
  sourceText: modifierId,
});

const spear = (explicits: ExplicitModifier[], itemLevel = 82): ItemState =>
  createItemState({
    baseId: 'base.akoyan-spear',
    baseName: 'Akoyan Spear',
    itemClassName: 'Spears',
    rarity: 'rare',
    itemLevel,
    quality: null,
    slots: [],
    explicits,
    otherLines: [],
    corrupted: false,
  });

const ids = (item: ItemState) => item.explicits.map((m) => (m.kind === 'resolved' ? m.modifierId : m.sourceText));

describe('source picks', () => {
  it('a tier of a new family is added', () => {
    const source = spear([]);
    const option = sourcePickOptions(db, VERSION, source).get('mod.local-attack-speed.t1');
    expect(option).toMatchObject({ allowed: true, action: { kind: 'add' } });
    expect(ids(applySourcePick(source, option))).toEqual(['mod.local-attack-speed.t1']);
  });

  it('the modifier on the source is selected, and only that tier', () => {
    const picks = sourcePickOptions(db, VERSION, spear([resolved('mod.local-attack-speed.t2')]));
    expect(isPickSelected(picks.get('mod.local-attack-speed.t2'))).toBe(true);
    expect(isPickSelected(picks.get('mod.local-attack-speed.t1'))).toBe(false);
    // A selected option is already there: clicking it changes nothing.
    expect(picks.get('mod.local-attack-speed.t2')?.allowed).toBe(false);
  });

  it('another tier of a family on the source replaces it in place instead of adding a duplicate', () => {
    const source = spear([resolved('mod.strength.t1'), resolved('mod.local-attack-speed.t2', true)]);
    const option = sourcePickOptions(db, VERSION, source).get('mod.local-attack-speed.t1');
    expect(option).toMatchObject({ allowed: true, action: { kind: 'replace', index: 1 } });
    const next = applySourcePick(source, option);
    expect(ids(next)).toEqual(['mod.strength.t1', 'mod.local-attack-speed.t1']);
    // Describing the item, not crafting: the fractured flag of the slot is kept.
    expect(next.explicits[1]?.fractured).toBe(true);
    // The selection moved with the item: T1 is now selected, T2 can be picked back.
    const after = sourcePickOptions(db, VERSION, next);
    expect(isPickSelected(after.get('mod.local-attack-speed.t1'))).toBe(true);
    expect(after.get('mod.local-attack-speed.t2')).toMatchObject({ allowed: true, action: { kind: 'replace', index: 1 } });
  });

  it('a tier swap still respects item level', () => {
    const source = spear([resolved('mod.local-attack-speed.t3')], 30);
    const option = sourcePickOptions(db, VERSION, source).get('mod.local-attack-speed.t1');
    expect(option?.allowed).toBe(false);
    expect(option?.reasons.map((r) => r.code)).toContain('item-level-too-low');
    expect(applySourcePick(source, option)).toBe(source);
  });

  it('a hybrid sharing a group with a modifier on the source stays unavailable', () => {
    // Critical hybrid collides with local critical chance but is another family: no silent swap.
    const source = spear([resolved('mod.local-critical-chance.t1')]);
    const hybrid = sourcePickOptions(db, VERSION, source).get('mod.local-critical-hybrid.t1');
    expect(hybrid).toMatchObject({ allowed: false, action: { kind: 'add' } });
    expect(hybrid?.reasons.map((r) => r.code)).toContain('group-already-on-item');
  });

  it('a full side blocks new families but not tier swaps', () => {
    const source = spear([
      resolved('mod.local-attack-speed.t2'),
      resolved('mod.local-critical-chance.t2'),
      resolved('mod.projectile-skill-levels.t2'),
    ]);
    const picks = sourcePickOptions(db, VERSION, source);
    expect(picks.get('mod.dexterity.t1')?.allowed).toBe(false);
    expect(picks.get('mod.dexterity.t1')?.reasons.map((r) => r.code)).toContain('no-free-affix-slot');
    expect(picks.get('mod.local-attack-speed.t1')).toMatchObject({ allowed: true, action: { kind: 'replace', index: 0 } });
  });

  it('the explicit replace mode sends every pick to that slot', () => {
    const source = spear([resolved('mod.strength.t1'), resolved('mod.local-attack-speed.t2')]);
    const option = sourcePickOptions(db, VERSION, source, 0).get('mod.dexterity.t1');
    expect(option).toMatchObject({ allowed: true, action: { kind: 'replace', index: 0 } });
    expect(ids(applySourcePick(source, option))).toEqual(['mod.dexterity.t1', 'mod.local-attack-speed.t2']);
  });
});

describe('target picks', () => {
  const target = targetSpecFromItem(spear([resolved('mod.local-attack-speed.t2'), resolved('mod.strength.t1')]));

  it('a tier of a new family adds a requirement', () => {
    const option = targetPickOptions(db, VERSION, target, null).get('mod.dexterity.t2');
    expect(option).toMatchObject({ allowed: true, action: { kind: 'add' } });
    expect(applyTargetPick(target, option).requirements.map((r) => r.modifierId)).toEqual([
      'mod.local-attack-speed.t2',
      'mod.strength.t1',
      'mod.dexterity.t2',
    ]);
  });

  it('another tier of a required family moves that requirement instead of duplicating it', () => {
    const picks = targetPickOptions(db, VERSION, target, null);
    expect(isPickSelected(picks.get('mod.local-attack-speed.t2'))).toBe(true);
    const option = picks.get('mod.local-attack-speed.t1');
    expect(option).toMatchObject({ allowed: true, action: { kind: 'retier', requirementId: 'r1' } });

    const next = applyTargetPick(target, option);
    expect(next.requirements).toHaveLength(2);
    expect(next.requirements[0]).toMatchObject({ id: 'r1', modifierId: 'mod.local-attack-speed.t1' });
    const after = targetPickOptions(db, VERSION, next, null);
    expect(isPickSelected(after.get('mod.local-attack-speed.t1'))).toBe(true);
    expect(isPickSelected(after.get('mod.local-attack-speed.t2'))).toBe(false);
  });

  it('an unavailable pick leaves the target unchanged', () => {
    const low = { ...target, itemLevel: 30 };
    const option = targetPickOptions(db, VERSION, low, null).get('mod.local-attack-speed.t1');
    expect(option?.allowed).toBe(false);
    expect(applyTargetPick(low, option)).toBe(low);
  });
});
