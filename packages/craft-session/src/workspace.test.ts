/**
 * The v0.3 workspace flow: tool → click current item, undo/redo/reset, manual source edits,
 * target requirements, pool modes, and the separation of source / current / target.
 */
import { describe, expect, it } from 'vitest';
import { akoyanSpearFixture, createCraftDb } from '@poe2-craft/craft-db';
import {
  addRequirement,
  createItemState,
  removeRequirement,
  setRequirementTier,
  targetSpecFromItem,
  type ExplicitModifier,
  type ItemState,
} from '@poe2-craft/craft-domain';
import type { AttemptCost } from '@poe2-craft/economy';
import { buildEligiblePool, explorerStatus, explorePool } from '@poe2-craft/probability-engine';
import {
  EMPTY_TOOL,
  addSourceModifier,
  applyStep,
  checkApplicable,
  createSession,
  isSourceOutOfSync,
  poolForMode,
  redoStep,
  removeSourceModifier,
  replaceSourceModifier,
  resetToSource,
  resolveTool,
  selectCurrency,
  sessionSpent,
  setSource,
  toggleOmen,
  toolPalette,
  undoLastStep,
  undoToStep,
  withTarget,
  type CraftSession,
} from './index';

const db = createCraftDb(akoyanSpearFixture);
const view = db.forVersion('0.5.0');

const resolved = (modifierId: string, fractured = false): ExplicitModifier => ({
  kind: 'resolved',
  modifierId,
  values: [],
  fractured,
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

const SOURCE = spear([resolved('mod.local-critical-chance.t1', true)]);
const TARGET = targetSpecFromItem(
  spear([resolved('mod.local-critical-chance.t1', true), resolved('mod.projectile-skill-levels.t1')]),
);
const cost = (total: number): AttemptCost => ({ unit: 'div', total, lines: [], missingPrices: [], complete: true });

const start = (): CraftSession => createSession({ gameVersion: '0.5.0', seed: 99, source: SOURCE, target: TARGET });

const click = (session: CraftSession, actionId = 'action.add-random-modifier', price = 0.5) => {
  const result = applyStep(session, { db, actionId, cost: cost(price) });
  if (result.status !== 'applied') throw new Error('expected the click to apply');
  return result.session;
};

describe('crafting tool palette', () => {
  it('offers only consumables some implemented action spends, grouped by category', () => {
    const palette = toolPalette(view);
    expect(palette.byCategory.currency?.map((c) => c.name)).toEqual(['Exalted Orb', 'Perfect Exalted Orb']);
    expect(palette.byCategory.omen?.map((c) => c.name)).toEqual([
      'Omen of Dextral Exaltation',
      'Omen of Sinistral Exaltation',
    ]);
    // Priced in the cost editor, but not a tool: no action models them yet.
    const all = Object.values(palette.byCategory).flat().map((c) => c.id);
    expect(all).not.toContain('currency.perfect-chaos-orb');
    expect(all).not.toContain('omen.whittling');
  });

  it('turns a currency + omen selection into the matching action', () => {
    expect(resolveTool(view, EMPTY_TOOL).status).toBe('none');
    const exalt = selectCurrency(EMPTY_TOOL, 'currency.exalted-orb');
    expect(resolveTool(view, exalt)).toMatchObject({ status: 'ready', action: { id: 'action.add-random-modifier' } });
    const dextral = toggleOmen(exalt, 'omen.dextral-exaltation');
    expect(resolveTool(view, dextral)).toMatchObject({ status: 'ready', action: { id: 'action.add-random-suffix' } });
    expect(toggleOmen(dextral, 'omen.dextral-exaltation').omenIds).toEqual([]);
    expect(selectCurrency(exalt, 'currency.exalted-orb').currencyId).toBeNull();
  });

  it('does not invent an action for a combination nobody modelled', () => {
    const tool = toggleOmen(selectCurrency(EMPTY_TOOL, 'currency.perfect-exalted-orb'), 'omen.dextral-exaltation');
    expect(resolveTool(view, tool).status).toBe('unsupported');
  });
});

describe('applying the active tool to the current item', () => {
  it('changes only the current item and records the step and its cost', () => {
    const before = start();
    const after = click(before);
    expect(after.current?.explicits).toHaveLength(2);
    expect(after.source).toBe(SOURCE);
    expect(after.target).toBe(TARGET);
    expect(SOURCE.explicits).toHaveLength(1);
    expect(after.steps).toHaveLength(1);
    expect(sessionSpent(after).total).toBe(0.5);
  });

  it('explains an impossible click instead of faking a result', () => {
    const full = spear([
      resolved('mod.local-critical-chance.t1', true),
      resolved('mod.dexterity.t1'),
      resolved('mod.strength.t1'),
    ]);
    const pool = buildEligiblePool({ item: full, context: { gameVersion: '0.5.0' }, db, actionId: 'action.add-random-suffix' });
    expect(checkApplicable(pool)).toEqual({ code: 'no-free-slot', sides: ['suffix'] });
    const session = createSession({ gameVersion: '0.5.0', seed: 1, source: full });
    const result = applyStep(session, { db, actionId: 'action.add-random-suffix', cost: cost(1) });
    expect(result.status).toBe('rejected');
    expect(result.session).toBe(session);
  });
});

describe('undo, redo and reset', () => {
  it('undo rolls back the item and the spending; redo restores the same step', () => {
    const one = click(start(), 'action.add-random-modifier', 0.5);
    const two = click(one, 'action.add-random-modifier', 0.25);
    const undone = undoLastStep(two);
    expect(undone.current).toBe(one.current);
    expect(sessionSpent(undone).total).toBe(0.5);
    expect(undone.redoStack).toHaveLength(1);
    const redone = redoStep(undone);
    expect(redone.current).toBe(two.current);
    expect(sessionSpent(redone).total).toBe(0.75);
    expect(redone.redoStack).toHaveLength(0);
  });

  it('a new click discards the redo branch', () => {
    const undone = undoLastStep(click(start()));
    expect(click(undone).redoStack).toEqual([]);
  });

  it('rolls back to a chosen history step', () => {
    let session = start();
    for (let i = 0; i < 3; i++) session = click(session);
    const back = undoToStep(session, 1);
    expect(back.steps).toHaveLength(1);
    expect(back.current).toBe(session.steps[0]?.after);
    expect(back.redoStack).toHaveLength(2);
  });

  it('reset returns current to source, clears history and spending, keeps source and target', () => {
    const reset = resetToSource(click(click(start())));
    expect(reset.current).toBe(SOURCE);
    expect(reset.steps).toEqual([]);
    expect(reset.redoStack).toEqual([]);
    expect(sessionSpent(reset).total).toBe(0);
    expect(reset.source).toBe(SOURCE);
    expect(reset.target).toBe(TARGET);
  });
});

describe('manual source editing', () => {
  it('adds and removes source modifiers without touching spending', () => {
    const projectile = view.getModifier('mod.projectile-skill-levels.t2')!;
    const added = addSourceModifier(SOURCE, projectile);
    expect(added.explicits.map((m) => m.kind === 'resolved' && m.modifierId)).toEqual([
      'mod.local-critical-chance.t1',
      'mod.projectile-skill-levels.t2',
    ]);
    expect(added.explicits[1]).toMatchObject({ sourceText: '+3 to Level of all Projectile Skills', values: [3] });
    expect(removeSourceModifier(added, 0).explicits).toHaveLength(1);
    expect(SOURCE.explicits).toHaveLength(1);
  });

  it('changes a tier in place and keeps the fractured flag', () => {
    const changed = replaceSourceModifier(SOURCE, 0, view.getModifier('mod.local-critical-chance.t3')!);
    expect(changed.explicits[0]).toMatchObject({ modifierId: 'mod.local-critical-chance.t3', fractured: true });
  });

  it('a source edit before crafting moves current with it; after crafting it waits for reset', () => {
    const edited = addSourceModifier(SOURCE, view.getModifier('mod.strength.t1')!);
    expect(setSource(start(), edited).current).toBe(edited);

    const crafted = click(start());
    const changedLater = setSource(crafted, edited);
    expect(changedLater.current).toBe(crafted.current);
    expect(isSourceOutOfSync(changedLater)).toBe(true);
    expect(sessionSpent(changedLater).total).toBe(sessionSpent(crafted).total);
    expect(resetToSource(changedLater).current).toBe(edited);
  });
});

describe('target requirements', () => {
  it('adds, retiers and removes requirements without touching source or current', () => {
    const session = start();
    const added = addRequirement(TARGET, 'mod.local-attack-speed.t2');
    expect(added.requirements.at(-1)).toMatchObject({ modifierId: 'mod.local-attack-speed.t2', origin: 'manual' });
    const id = added.requirements.at(-1)!.id;
    const retiered = setRequirementTier(added, id, 'mod.local-attack-speed.t1');
    expect(retiered.requirements.find((r) => r.id === id)?.modifierId).toBe('mod.local-attack-speed.t1');
    expect(removeRequirement(retiered, id).requirements).toHaveLength(TARGET.requirements.length);

    const next = withTarget(session, retiered);
    expect(next.current).toBe(session.current);
    expect(next.source).toBe(session.source);
  });
});

describe('modifier pool modes', () => {
  const statusOf = (session: CraftSession, mode: Parameters<typeof poolForMode>[2], id: string) => {
    const { pool } = poolForMode(session, db, mode);
    if (pool?.status !== 'ready') throw new Error('pool not ready');
    const entry = pool.entries.find((e) => e.definition.id === id)!;
    return explorerStatus(entry);
  };

  it('inspect evaluates the current item with the active tool', () => {
    const session = start();
    expect(statusOf(session, { kind: 'inspect', actionId: 'action.add-random-suffix' }, 'mod.local-physical-percent.t1')).toBe('blocked');
    expect(poolForMode(session, db, { kind: 'inspect', actionId: null }).pool).toBeNull();
  });

  it('edit-source allows both sides regardless of the tool and evaluates the source', () => {
    const crafted = click(start());
    const mode = { kind: 'edit-source' } as const;
    expect(poolForMode(crafted, db, mode).item).toBe(crafted.source);
    expect(statusOf(crafted, mode, 'mod.local-physical-percent.t1')).toBe('eligible');
    expect(statusOf(crafted, mode, 'mod.local-critical-chance.t1')).toBe('already-present');
  });

  it('edit-source with a replace index frees that modifier group', () => {
    expect(statusOf(start(), { kind: 'edit-source', replaceIndex: 0 }, 'mod.local-critical-chance.t2')).toBe('eligible');
  });

  it('edit-target evaluates the requirements as an item', () => {
    const session = start();
    const mode = { kind: 'edit-target' } as const;
    expect(statusOf(session, mode, 'mod.projectile-skill-levels.t1')).toBe('already-present');
    expect(statusOf(session, mode, 'mod.projectile-skill-levels.t3')).toBe('blocked');
    expect(statusOf(session, mode, 'mod.local-attack-speed.t1')).toBe('eligible');
  });

  it('the same explorer works for every mode', () => {
    for (const mode of [{ kind: 'edit-source' }, { kind: 'edit-target' }, { kind: 'inspect', actionId: 'action.add-random-modifier' }] as const) {
      const { pool } = poolForMode(start(), db, mode);
      if (pool?.status !== 'ready') throw new Error('pool not ready');
      expect(explorePool(pool, view).tabs.map((t) => t.id)).toEqual(['prefix', 'suffix']);
    }
  });
});
