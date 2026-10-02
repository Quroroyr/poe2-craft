/**
 * v0.5: the held tool (currency + omen, switching, incompatible / unmodelled pairs), target status
 * per requirement and target progress, spending split by consumable.
 */
import { describe, expect, it } from 'vitest';
import { akoyanSpearFixture, createCraftDb } from '@poe2-craft/craft-db';
import { addRequirement, type ItemState } from '@poe2-craft/craft-domain';
import type { PriceSnapshot } from '@poe2-craft/economy';
import {
  EMPTY_TOOL,
  addSourceModifier,
  applyToolStep,
  clearOmens,
  compareToTarget,
  createItemFromBase,
  createSession,
  pickTool,
  redoStep,
  resolveTool,
  selectCurrency,
  sessionSpent,
  sessionSpentByConsumable,
  setSourceModifierFractured,
  targetForSource,
  targetOutlook,
  toggleOmen,
  undoLastStep,
  type CraftSession,
} from './index';

const db = createCraftDb(akoyanSpearFixture);
const VERSION = '0.5.0';
const view = db.forVersion(VERSION);
const def = (id: string) => view.getModifier(id)!;
const consumable = (id: string) => view.getConsumable(id)!;

const PRICES: PriceSnapshot = {
  id: 'test',
  unit: 'div',
  capturedAt: '2026-10-02',
  source: 'manual',
  prices: { 'currency.exalted-orb': 0.25, 'omen.dextral-exaltation': 1 },
};

const EXALT = selectCurrency(EMPTY_TOOL, 'currency.exalted-orb');
const EXALT_DEXTRAL = toggleOmen(EXALT, 'omen.dextral-exaltation');

describe('held tool: currency and omen', () => {
  it('a currency alone is the active tool', () => {
    const tool = resolveTool(view, EXALT);
    expect(tool.status).toBe('ready');
    expect(tool.status === 'ready' && tool.consumables.map((c) => c.id)).toEqual(['currency.exalted-orb']);
  });

  it('an omen without a currency waits for one and stays visible', () => {
    const tool = resolveTool(view, toggleOmen(EMPTY_TOOL, 'omen.dextral-exaltation'));
    expect(tool).toMatchObject({ status: 'none' });
    expect(tool.status === 'none' && tool.omens.map((c) => c.id)).toEqual(['omen.dextral-exaltation']);
  });

  it('currency + omen resolve to the action that spends exactly both', () => {
    const tool = resolveTool(view, EXALT_DEXTRAL);
    expect(tool.status === 'ready' && tool.action.id).toBe('action.add-random-suffix');
    expect(tool.status === 'ready' && tool.consumables.map((c) => c.category)).toEqual(['currency', 'omen']);
  });

  it('switching the currency keeps the omen held', () => {
    let tool = EXALT_DEXTRAL;
    for (const id of ['currency.divine-orb', 'currency.chaos-orb', 'currency.perfect-exalted-orb']) {
      tool = pickTool(tool, consumable(id));
      expect(tool).toEqual({ currencyId: id, omenIds: ['omen.dextral-exaltation'] });
    }
    // Putting the currency back still keeps the omen; only removing it explicitly drops it.
    expect(pickTool(tool, consumable('currency.perfect-exalted-orb')).omenIds).toEqual(['omen.dextral-exaltation']);
    expect(clearOmens(tool).omenIds).toEqual([]);
  });

  it('tells an incompatible pair from a compatible pair nobody modelled', () => {
    // Omen of Dextral Exaltation modifies Exalted Orbs (scope data), not Divine Orb.
    const divine = resolveTool(view, pickTool(EXALT_DEXTRAL, consumable('currency.divine-orb')));
    expect(divine).toMatchObject({ status: 'incompatible', incompatibleOmenIds: ['omen.dextral-exaltation'] });
    // Perfect Exalted Orb is in the omen's scope, but no action models that pair.
    const perfect = resolveTool(view, pickTool(EXALT_DEXTRAL, consumable('currency.perfect-exalted-orb')));
    expect(perfect.status).toBe('unsupported');
    // A currency without any modelled action is unsupported too.
    expect(resolveTool(view, selectCurrency(EMPTY_TOOL, 'currency.chaos-orb')).status).toBe('unsupported');
  });

  it('a click with an incompatible or unmodelled tool changes nothing and spends nothing', () => {
    const source = createItemFromBase(view, 'base.akoyan-spear', 82)!;
    const before = createSession({ gameVersion: VERSION, seed: 3, source });
    for (const id of ['currency.divine-orb', 'currency.perfect-exalted-orb']) {
      const result = applyToolStep(before, { db, tool: pickTool(EXALT_DEXTRAL, consumable(id)), prices: PRICES });
      expect(result.status).toBe('rejected');
      expect(result.session).toBe(before);
    }
    expect(applyToolStep(before, { db, tool: pickTool(EXALT_DEXTRAL, consumable('currency.divine-orb')), prices: PRICES }))
      .toMatchObject({ reason: 'incompatible-tool' });
  });
});

describe('target status and progress', () => {
  const spear = (mods: string[], fractured: number[] = []): ItemState => {
    let item = createItemFromBase(view, 'base.akoyan-spear', 82)!;
    for (const id of mods) item = addSourceModifier(item, def(id));
    for (const i of fractured) item = setSourceModifierFractured(item, i, true);
    return item;
  };
  const target = (() => {
    let t = targetForSource(spear([]));
    t = addRequirement(t, 'mod.local-critical-chance.t1', true); // fractured crit
    t = addRequirement(t, 'mod.local-attack-speed.t2'); // attack speed T2+
    t = addRequirement(t, 'mod.local-physical-percent.t1'); // phys % T1
    t = addRequirement(t, 'mod.projectile-skill-levels.t1'); // projectile levels T1
    return t;
  })();
  const outlook = (item: ItemState) => targetOutlook(db, VERSION, item, compareToTarget(item, target, view));
  const states = (item: ItemState) => outlook(item).rows.map((r) => r.state);

  it('gives every requirement its own state against the current item', () => {
    // Plain crit (not fractured), attack speed T3 (worse than T2), no phys %, no projectile levels.
    const item = spear(['mod.local-critical-chance.t1', 'mod.local-attack-speed.t3']);
    expect(states(item)).toEqual(['not-fractured', 'worse-tier', 'craft', 'craft']);
  });

  it('a missing family the item has no room for is "missing", with the reason', () => {
    // Three suffixes already: the projectile-levels suffix cannot be added any more.
    const full = spear(['mod.local-critical-chance.t1', 'mod.local-attack-speed.t1', 'mod.dexterity.t1'], [0]);
    const rows = outlook(full).rows;
    expect(rows.map((r) => r.state)).toEqual(['done', 'done', 'craft', 'missing']);
    expect(rows[3]?.reasons).toContainEqual({ code: 'no-free-affix-slot', side: 'suffix', used: 3, max: 3 });
  });

  it('counts progress as met requirements over all requirements', () => {
    const item = spear(['mod.local-critical-chance.t1', 'mod.local-attack-speed.t2'], [0]);
    expect(outlook(item)).toMatchObject({ done: 2, total: 4, ratio: 0.5 });
    expect(targetOutlook(db, VERSION, item, compareToTarget(item, targetForSource(item), view)).ratio).toBeNull();
  });

  it('recomputes after every craft step, undo and redo', () => {
    const source = spear(['mod.local-critical-chance.t1'], [0]);
    let session: CraftSession = createSession({ gameVersion: VERSION, seed: 11, source, target });
    const doneNow = () => outlook(session.current!).done;
    expect(doneNow()).toBe(1);
    let changed = false;
    for (let i = 0; i < 5 && !changed; i++) {
      const before = states(session.current!);
      const result = applyToolStep(session, { db, tool: EXALT, prices: PRICES });
      if (result.status !== 'applied') break;
      session = result.session;
      changed = states(session.current!).join() !== before.join();
    }
    // Each step adds one modifier, so the outlook is a pure function of the current item.
    expect(states(undoLastStep(session).current!)).toEqual(states(session.steps.at(-1)!.before));
    expect(states(redoStep(undoLastStep(session)).current!)).toEqual(states(session.current!));
  });
});

describe('spending split by consumable', () => {
  it('sums each consumable over the recorded steps and agrees with the total', () => {
    const source = createItemFromBase(view, 'base.akoyan-spear', 82)!;
    let session = createSession({ gameVersion: VERSION, seed: 5, source });
    for (const tool of [EXALT, EXALT_DEXTRAL, EXALT]) {
      const result = applyToolStep(session, { db, tool, prices: PRICES });
      if (result.status !== 'applied') throw new Error('expected the click to apply');
      session = result.session;
    }
    expect(sessionSpentByConsumable(session)).toEqual([
      { consumableId: 'currency.exalted-orb', quantity: 3, total: 0.75, unpriced: false },
      { consumableId: 'omen.dextral-exaltation', quantity: 1, total: 1, unpriced: false },
    ]);
    expect(sessionSpent(session).total).toBe(1.75);
    // Undone steps leave the split, as they leave the total.
    expect(sessionSpentByConsumable(undoLastStep(session))[0]?.quantity).toBe(2);
  });
});
