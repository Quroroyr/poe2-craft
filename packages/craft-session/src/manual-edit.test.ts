/**
 * Manual edits of the current item (ADR 009): sandbox steps in the shared history. They change
 * only `current`, never cost anything, undo / redo like craft steps and keep the item rules.
 */
import { describe, expect, it } from 'vitest';
import { akoyanSpearFixture, createCraftDb } from '@poe2-craft/craft-db';
import { createItemState, targetSpecFromItem, type ExplicitModifier, type ItemState } from '@poe2-craft/craft-domain';
import type { AttemptCost } from '@poe2-craft/economy';
import {
  addModifierToTarget,
  applyManualEdit,
  applyStep,
  betterTierOption,
  createSession,
  currentModifierMarks,
  currentTierOptions,
  hasManualEdits,
  redoStep,
  sessionSpent,
  undoLastStep,
  type CraftSession,
  type ManualEdit,
} from './index';

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

const SOURCE = spear([resolved('mod.local-critical-chance.t1', true), resolved('mod.local-attack-speed.t3')]);
const TARGET = targetSpecFromItem(spear([resolved('mod.projectile-skill-levels.t1')]));
const cost = (total: number): AttemptCost => ({ unit: 'div', total, lines: [], missingPrices: [], complete: true });
const start = (source = SOURCE): CraftSession => createSession({ gameVersion: VERSION, seed: 7, source, target: TARGET });

const craft = (session: CraftSession) => {
  const result = applyStep(session, { db, actionId: 'action.add-random-modifier', cost: cost(0.5) });
  if (result.status !== 'applied') throw new Error('expected the craft to apply');
  return result.session;
};
const edit = (session: CraftSession, e: ManualEdit) => {
  const result = applyManualEdit(session, db, e);
  if (result.status !== 'applied') throw new Error(`expected the edit to apply, got ${result.reason}`);
  return result.session;
};
const ids = (item: ItemState | null) => item?.explicits.map((m) => (m.kind === 'resolved' ? m.modifierId : m.sourceText));

describe('manual edits of the current item', () => {
  it('a retier changes only current, costs nothing and is recorded as a manual step', () => {
    const session = start();
    const result = applyManualEdit(session, db, { operation: 'retier', index: 1, modifierId: 'mod.local-attack-speed.t2' });
    if (result.status !== 'applied') throw new Error('expected applied');
    const next = result.session;

    expect(ids(next.current)).toEqual(['mod.local-critical-chance.t1', 'mod.local-attack-speed.t2']);
    expect(next.source).toBe(session.source);
    expect(next.target).toBe(session.target);
    expect(sessionSpent(next)).toMatchObject({ total: 0, stepCount: 0 });
    expect(next.rollCount).toBe(session.rollCount);
    expect(result.step).toMatchObject({
      kind: 'manual-edit',
      index: 1,
      operation: 'retier',
      modifierIndex: 1,
      from: { modifierId: 'mod.local-attack-speed.t3', tier: 3 },
      to: { modifierId: 'mod.local-attack-speed.t2', tier: 2 },
    });
    expect(result.step.before).toBe(session.current);
    expect(result.step.after).toBe(next.current);
    expect(result.step.label).toContain('T3 → T2');
    expect(next.steps).toEqual([result.step]);
    expect(hasManualEdits(next)).toBe(true);
  });

  it('"upgrade one tier" follows the real family list, not tier - 1', () => {
    const current = start().current!;
    const tiers = currentTierOptions(db, VERSION, current, 1);
    expect(tiers.map((t) => t.definition.tier)).toEqual([1, 2, 3]);
    expect(betterTierOption(tiers, 'mod.local-attack-speed.t3')?.definition.id).toBe('mod.local-attack-speed.t2');
    expect(betterTierOption(tiers, 'mod.local-attack-speed.t1')).toBeNull();
    // Only the existing tiers are offered: a gap in the numbering is never invented.
    expect(betterTierOption(tiers.filter((t) => t.definition.tier !== 2), 'mod.local-attack-speed.t3')?.definition.tier).toBe(1);
  });

  it('a retier keeps the item rules: item level, family, known modifier', () => {
    const low = start(spear([resolved('mod.local-attack-speed.t3')], 30));
    const tooHigh = applyManualEdit(low, db, { operation: 'retier', index: 0, modifierId: 'mod.local-attack-speed.t1' });
    expect(tooHigh).toMatchObject({ status: 'rejected', reason: 'not-allowed' });
    if (tooHigh.status === 'rejected') expect(tooHigh.reasons.map((r) => r.code)).toContain('item-level-too-low');
    expect(tooHigh.session).toBe(low);
    expect(currentTierOptions(db, VERSION, low.current!, 0).find((t) => t.definition.tier === 1)?.allowed).toBe(false);

    expect(applyManualEdit(low, db, { operation: 'retier', index: 0, modifierId: 'mod.dexterity.t1' })).toMatchObject({
      reason: 'not-same-family',
    });
    expect(applyManualEdit(low, db, { operation: 'retier', index: 0, modifierId: 'mod.nothing' })).toMatchObject({
      reason: 'unknown-modifier',
    });
    expect(applyManualEdit(low, db, { operation: 'retier', index: 5, modifierId: 'mod.local-attack-speed.t2' })).toMatchObject({
      reason: 'no-modifier',
    });
  });

  it('remove drops that explicit only', () => {
    const next = edit(start(), { operation: 'remove', index: 0 });
    expect(ids(next.current)).toEqual(['mod.local-attack-speed.t3']);
    expect(next.steps.at(-1)).toMatchObject({ operation: 'remove', to: null });
    expect(ids(next.source)).toEqual(ids(SOURCE));
  });

  it('fracture and unfracture set the flag of that explicit — not a Fracturing Orb', () => {
    const fractured = edit(start(), { operation: 'fracture', index: 1 });
    expect(fractured.current?.explicits[1]?.fractured).toBe(true);
    expect(sessionSpent(fractured).total).toBe(0);
    expect(applyManualEdit(fractured, db, { operation: 'fracture', index: 1 })).toMatchObject({ reason: 'no-change' });

    const unfractured = edit(fractured, { operation: 'unfracture', index: 0 });
    expect(unfractured.current?.explicits.map((m) => m.fractured)).toEqual([false, true]);
    expect(unfractured.steps.map((s) => s.kind === 'manual-edit' && s.operation)).toEqual(['fracture', 'unfracture']);
  });

  it('replace puts another allowed modifier in place and keeps the fractured flag', () => {
    const next = edit(start(), { operation: 'replace', index: 0, modifierId: 'mod.dexterity.t1' });
    expect(ids(next.current)).toEqual(['mod.dexterity.t1', 'mod.local-attack-speed.t3']);
    expect(next.current?.explicits[0]?.fractured).toBe(true);
    // A second modifier of a family already on the item would break the group rule.
    const clash = applyManualEdit(start(), db, { operation: 'replace', index: 0, modifierId: 'mod.local-attack-speed.t1' });
    expect(clash).toMatchObject({ status: 'rejected', reason: 'not-allowed' });
    if (clash.status === 'rejected') expect(clash.reasons.map((r) => r.code)).toContain('group-already-on-item');
  });
});

describe('manual edits in the session history', () => {
  it('undo / redo walk through manual edits; redo uses no new roll', () => {
    const s0 = start();
    const s1 = edit(s0, { operation: 'retier', index: 1, modifierId: 'mod.local-attack-speed.t2' });
    const s2 = edit(s1, { operation: 'fracture', index: 1 });

    const u1 = undoLastStep(s2);
    expect(u1.current).toBe(s1.current);
    const u2 = undoLastStep(u1);
    expect(u2.current).toBe(s0.current);
    expect(u2.redoStack).toHaveLength(2);

    const r = redoStep(redoStep(u2));
    expect(r.current).toBe(s2.current);
    expect(r.rollCount).toBe(s2.rollCount);
  });

  it('craft → manual remove → manual fracture → craft: undo goes back one state at a time', () => {
    const c1 = craft(start());
    const m1 = edit(c1, { operation: 'remove', index: 0 });
    const m2 = edit(m1, { operation: 'fracture', index: 0 });
    const c2 = craft(m2);
    expect(c2.steps.map((s) => s.kind)).toEqual(['craft', 'manual-edit', 'manual-edit', 'craft']);
    expect(c2.steps.map((s) => s.index)).toEqual([1, 2, 3, 4]);
    // Only the two craft steps are spending.
    expect(sessionSpent(c2)).toMatchObject({ total: 1, stepCount: 2 });

    const back = [undoLastStep(c2)];
    back.push(undoLastStep(back[0]!), undoLastStep(undoLastStep(back[0]!)));
    expect(back.map((s) => s.current)).toEqual([m2.current, m1.current, c1.current]);
    expect(sessionSpent(back[2]!)).toMatchObject({ total: 0.5, stepCount: 1 });

    // Redo restores the very same craft result: no re-roll.
    const forward = redoStep(redoStep(redoStep(back[2]!)));
    expect(forward.current).toBe(c2.current);
  });

  it('a new manual edit or a new craft after undo drops the redo branch', () => {
    const edited = edit(start(), { operation: 'fracture', index: 1 });
    const undone = undoLastStep(edited);
    expect(undone.redoStack).toHaveLength(1);
    expect(edit(undone, { operation: 'remove', index: 1 }).redoStack).toEqual([]);
    expect(craft(undone).redoStack).toEqual([]);

    const crafted = undoLastStep(craft(start()));
    expect(edit(crafted, { operation: 'remove', index: 0 }).redoStack).toEqual([]);
  });

  it('marks follow positions: crafted, edited, removed', () => {
    const c1 = craft(start());
    expect(currentModifierMarks(c1)).toEqual([
      { crafted: false, edited: false },
      { crafted: false, edited: false },
      { crafted: true, edited: false },
    ]);
    const m = edit(edit(c1, { operation: 'remove', index: 0 }), { operation: 'fracture', index: 1 });
    expect(currentModifierMarks(m)).toEqual([
      { crafted: false, edited: false },
      { crafted: true, edited: true },
    ]);
  });
});

describe('add a modifier to the target', () => {
  it('adds a new family, then moves the same family instead of duplicating it', () => {
    const added = addModifierToTarget(db, VERSION, TARGET, SOURCE, 'mod.local-attack-speed.t3');
    expect(added.status).toBe('added');
    expect(added.target.requirements).toHaveLength(2);

    const moved = addModifierToTarget(db, VERSION, added.target, SOURCE, 'mod.local-attack-speed.t2');
    expect(moved.status).toBe('retiered');
    expect(moved.target.requirements).toHaveLength(2);
    expect(moved.target.requirements.at(-1)?.modifierId).toBe('mod.local-attack-speed.t2');

    expect(addModifierToTarget(db, VERSION, moved.target, SOURCE, 'mod.local-attack-speed.t2').status).toBe('already');
  });

  it('keeps a fractured requirement when asked', () => {
    const added = addModifierToTarget(db, VERSION, TARGET, SOURCE, 'mod.local-critical-chance.t1', true);
    expect(added.target.requirements.at(-1)).toMatchObject({ modifierId: 'mod.local-critical-chance.t1', fractured: true });
    const plain = addModifierToTarget(db, VERSION, TARGET, SOURCE, 'mod.local-critical-chance.t1');
    const updated = addModifierToTarget(db, VERSION, plain.target, SOURCE, 'mod.local-critical-chance.t1', true);
    expect(updated.status).toBe('updated');
    expect(updated.target.requirements).toHaveLength(2);
    expect(updated.target.requirements.at(-1)?.fractured).toBe(true);
  });
});
