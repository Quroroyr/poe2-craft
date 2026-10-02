/**
 * v0.4: base builder and initial item setup — create a source from a base, configure item level,
 * quality and slots, add starting modifiers, mark them fractured; then craft with the held tool.
 * Expected values are read off the fixture (comments name the fixture lines they come from).
 */
import { describe, expect, it } from 'vitest';
import { akoyanSpearFixture, createCraftDb, type CraftDataset } from '@poe2-craft/craft-db';
import { addRequirement, type ItemState } from '@poe2-craft/craft-domain';
import type { PriceSnapshot } from '@poe2-craft/economy';
import {
  EMPTY_TOOL,
  addSourceModifier,
  applyToolStep,
  compareToTarget,
  createItemFromBase,
  createSession,
  hasCraftHistory,
  isSourceOutOfSync,
  itemSetupFields,
  outstandingTargetModifiers,
  poolForMode,
  removeSourceModifier,
  replaceSourceModifier,
  resetToSource,
  resolveTool,
  selectCurrency,
  sessionSpent,
  setItemLevel,
  setQuality,
  setSlotCount,
  setSource,
  setSourceModifierFractured,
  sourceModifierIssues,
  sourceTierOptions,
  targetBaseCheck,
  targetForSource,
  toggleOmen,
  undoLastStep,
  withTarget,
  type CraftSession,
} from './index';

const db = createCraftDb(akoyanSpearFixture);
const VERSION = '0.5.0';
const view = db.forVersion(VERSION);
const def = (id: string) => {
  const d = view.getModifier(id);
  if (!d) throw new Error(`fixture has no ${id}`);
  return d;
};

const PRICES: PriceSnapshot = {
  id: 'test',
  unit: 'div',
  capturedAt: '2026-10-02',
  source: 'manual',
  prices: { 'currency.exalted-orb': 0.25, 'omen.dextral-exaltation': 1 },
};
const EXALT = selectCurrency(EMPTY_TOOL, 'currency.exalted-orb');

const build = (baseId: string, itemLevel = 82): ItemState => {
  const item = createItemFromBase(view, baseId, itemLevel);
  if (!item) throw new Error(`fixture has no ${baseId}`);
  return item;
};

/** The QA scenario item: Akoyan Spear ilvl 82, quality 20, 1 rune socket, fractured T1 crit chance. */
const scenarioSource = (): ItemState => {
  let item = build('base.akoyan-spear', 82);
  item = setQuality(view, item, 20);
  item = setSlotCount(view, item, 'rune-socket', 1);
  item = addSourceModifier(item, def('mod.local-critical-chance.t1'));
  return setSourceModifierFractured(item, 0, true);
};

const session = (source: ItemState | null = scenarioSource()): CraftSession =>
  createSession({ gameVersion: VERSION, seed: 7, source, target: targetForSource(source) });

const click = (s: CraftSession, tool = EXALT): CraftSession => {
  const result = applyToolStep(s, { db, tool, prices: PRICES });
  if (result.status !== 'applied') throw new Error('expected the click to apply');
  return result.session;
};

describe('base selector → source', () => {
  it('creates a blank rare source from a base, referring to it by id', () => {
    const item = build('base.akoyan-spear', 82);
    expect(item).toMatchObject({
      baseId: 'base.akoyan-spear',
      baseName: 'Akoyan Spear',
      itemClassName: 'Spears',
      rarity: 'rare',
      itemLevel: 82,
      // Spear quality rule is 0–20 and rune sockets [0, 1]: both start at the first value.
      quality: 0,
      slots: [{ kind: 'rune-socket', count: 0 }],
      explicits: [],
    });
    // The base definition (art, properties, setup rules, tags) is not copied into the state.
    expect(Object.keys(item)).not.toEqual(expect.arrayContaining(['artAssetId']));
    expect(item).not.toHaveProperty('details');
    expect(item).not.toHaveProperty('tags');
  });

  it('keeps the base class and art reference on the definition', () => {
    const base = view.getBase(build('base.akoyan-spear').baseId!);
    expect(base?.itemClassId).toBe('class.spear');
    expect(view.getItemClass(base!.itemClassId)?.clipboardName).toBe('Spears');
    expect(base?.artAssetId).toBe('Art/2DItems/Weapons/OneHandWeapons/OneHandSpears/1HSpear10');
  });

  it('every catalog base has a class, art and details with provenance', () => {
    for (const base of view.listBases()) {
      expect(view.getItemClass(base.itemClassId), base.id).toBeDefined();
      expect(base.artAssetId, base.id).toMatch(/^Art\/2DItems\//);
      expect(base.details?.provenance.sourceId, base.id).toBe('official.trade2-listings');
    }
    expect(view.listItemClasses().map((c) => c.name)).toEqual(['Spear', 'Bow', 'Quarterstaff']);
  });

  it('returns null for a base that is not in the catalog', () => {
    expect(createItemFromBase(view, 'base.nope', 82)).toBeNull();
  });
});

describe('item setup', () => {
  it('changes the item level within the input bounds', () => {
    const item = build('base.akoyan-spear', 82);
    expect(setItemLevel(item, 70).itemLevel).toBe(70);
    expect(setItemLevel(item, 0).itemLevel).toBe(1);
    expect(setItemLevel(item, 150).itemLevel).toBe(100);
    expect(setItemLevel(item, Number.NaN)).toBe(item);
    expect(item.itemLevel).toBe(82);
  });

  it('changes quality within the base rule and refuses it without a rule', () => {
    const item = build('base.akoyan-spear');
    expect(setQuality(view, item, 20).quality).toBe(20);
    expect(setQuality(view, item, 25).quality).toBe(20);
    expect(setQuality(view, item, -3).quality).toBe(0);

    // The same base without a quality rule: quality is not offered and cannot be set.
    const noRules: CraftDataset = {
      ...akoyanSpearFixture,
      bases: akoyanSpearFixture.bases.map((b) => (b.id === 'base.akoyan-spear' ? { ...b, setup: {} } : b)),
    };
    const bareView = createCraftDb(noRules).forVersion(VERSION);
    const bare = createItemFromBase(bareView, 'base.akoyan-spear', 82)!;
    expect(bare.quality).toBeNull();
    expect(bare.slots).toEqual([]);
    expect(itemSetupFields(bareView, bare)).toMatchObject({ quality: null, slots: [] });
    expect(setQuality(bareView, bare, 20)).toBe(bare);
    expect(setSlotCount(bareView, bare, 'rune-socket', 1)).toBe(bare);
  });

  it('accepts only slot counts the base lists', () => {
    const spear = build('base.akoyan-spear');
    expect(setSlotCount(view, spear, 'rune-socket', 1).slots).toEqual([{ kind: 'rune-socket', count: 1 }]);
    // Spears allow [0, 1] rune sockets, bows [0, 1, 2] (fixture setup rules).
    expect(setSlotCount(view, spear, 'rune-socket', 2)).toBe(spear);
    expect(setSlotCount(view, spear, 'augment-slot', 1)).toBe(spear);
    const bow = build('base.recurve-bow');
    expect(setSlotCount(view, bow, 'rune-socket', 2).slots).toEqual([{ kind: 'rune-socket', count: 2 }]);
  });

  it('adds, re-tiers and removes starting modifiers', () => {
    let item = build('base.akoyan-spear');
    item = addSourceModifier(item, def('mod.local-critical-chance.t1'));
    item = addSourceModifier(item, def('mod.local-attack-speed.t2'));
    item = replaceSourceModifier(item, 1, def('mod.local-attack-speed.t1'));
    expect(item.explicits.map((m) => m.kind === 'resolved' && m.modifierId)).toEqual([
      'mod.local-critical-chance.t1',
      'mod.local-attack-speed.t1',
    ]);
    expect(removeSourceModifier(item, 0).explicits).toHaveLength(1);
  });

  it('offers tiers through the manual-edit pool, with the reason a tier is not allowed', () => {
    const item = addSourceModifier(build('base.akoyan-spear', 70), def('mod.local-critical-chance.t2'));
    const options = sourceTierOptions(db, VERSION, item, 0);
    // Critical Hit Chance tiers need ilvl 73 / 44 / 20 / 1: at ilvl 70 only T1 is out.
    expect(options.map((o) => [o.definition.tier, o.allowed])).toEqual([
      [1, false],
      [2, true],
      [3, true],
      [4, true],
    ]);
    expect(options[0]?.reasons).toEqual([{ code: 'item-level-too-low', required: 73, itemLevel: 70 }]);
  });

  it('flags, but keeps, starting modifiers the new item level no longer allows', () => {
    const item = addSourceModifier(build('base.akoyan-spear', 82), def('mod.local-critical-chance.t1'));
    expect(sourceModifierIssues(db, VERSION, item).size).toBe(0);
    const lowered = setItemLevel(item, 70);
    expect(lowered.explicits).toHaveLength(1);
    expect(sourceModifierIssues(db, VERSION, lowered).get(0)).toEqual([
      { code: 'item-level-too-low', required: 73, itemLevel: 70 },
    ]);
  });
});

describe('fractured setup', () => {
  it('marks and unmarks an existing modifier as fractured without touching the others', () => {
    let item = build('base.akoyan-spear');
    item = addSourceModifier(item, def('mod.local-critical-chance.t1'));
    item = addSourceModifier(item, def('mod.local-attack-speed.t1'));
    const marked = setSourceModifierFractured(item, 0, true);
    expect(marked.explicits.map((m) => m.fractured)).toEqual([true, false]);
    expect(item.explicits.map((m) => m.fractured)).toEqual([false, false]);
    expect(setSourceModifierFractured(marked, 0, false).explicits.map((m) => m.fractured)).toEqual([false, false]);
    expect(setSourceModifierFractured(marked, 0, true)).toBe(marked);
    expect(setSourceModifierFractured(marked, 9, true)).toBe(marked);
  });

  it('a fracture edit of the source costs nothing and records no step', () => {
    const crafted = click(session());
    const spent = sessionSpent(crafted);
    const edited = setSource(crafted, setSourceModifierFractured(crafted.source!, 0, false));
    expect(sessionSpent(edited)).toEqual(spent);
    expect(edited.steps).toBe(crafted.steps);
    expect(edited.current).toBe(crafted.current);
  });

  it('current gets the fractured flag on session start, on a source edit before crafting and on reset', () => {
    const s = session();
    expect(s.current?.explicits[0]?.fractured).toBe(true);

    const plain = session(addSourceModifier(build('base.akoyan-spear'), def('mod.local-critical-chance.t1')));
    const marked = setSource(plain, setSourceModifierFractured(plain.source!, 0, true));
    expect(marked.current?.explicits[0]?.fractured).toBe(true);

    const reset = resetToSource(click(click(s)));
    expect(reset.current).toBe(s.source);
    expect(reset.current?.explicits[0]).toMatchObject({ modifierId: 'mod.local-critical-chance.t1', fractured: true });
  });

  it('crafting keeps the fractured modifier as it was', () => {
    const after = click(session()).current!;
    expect(after.explicits[0]).toMatchObject({ modifierId: 'mod.local-critical-chance.t1', fractured: true });
    expect(after.explicits.slice(1).every((m) => !m.fractured)).toBe(true);
  });
});

describe('session and source edits', () => {
  it('a source edit after crafting, then undoing every step, still needs a reset (regression P1-10)', () => {
    const crafted = click(session(build('base.akoyan-spear')));
    const edited = setSource(crafted, addSourceModifier(crafted.source!, def('mod.dexterity.t1')));
    const undone = undoLastStep(edited);
    expect(undone.steps).toHaveLength(0);
    // Before the fix: no applied step left → "in sync", reset disabled, current ≠ source.
    expect(undone.current).not.toBe(undone.source);
    expect(isSourceOutOfSync(undone)).toBe(true);
    expect(hasCraftHistory(undone)).toBe(true);
    const reset = resetToSource(undone);
    expect(reset.current).toBe(reset.source);
    expect(isSourceOutOfSync(reset)).toBe(false);
    expect(hasCraftHistory(reset)).toBe(false);
  });

  it('source edits leave the target alone; another base only changes the compatibility check', () => {
    const s = withTarget(session(), addRequirement(targetForSource(scenarioSource()), 'mod.projectile-skill-levels.t1'));
    const edited = setSource(s, setItemLevel(s.source!, 75));
    expect(edited.target).toBe(s.target);
    expect(targetBaseCheck(edited.source, edited.target)).toBe('match');

    const bow = setSource(s, build('base.recurve-bow'));
    expect(bow.target).toBe(s.target);
    expect(targetBaseCheck(bow.source, bow.target)).toBe('mismatch');
  });
});

describe('target', () => {
  it('checks the target base against the source base', () => {
    const spear = build('base.akoyan-spear');
    expect(targetBaseCheck(spear, targetForSource(spear))).toBe('match');
    expect(targetBaseCheck(spear, targetForSource(build('base.orichalcum-spear')))).toBe('mismatch');
    expect(targetBaseCheck(spear, { ...targetForSource(spear), baseId: null })).toBe('unknown');
    expect(targetBaseCheck(null, targetForSource(spear))).toBe('unknown');
  });

  it('a fractured requirement is not met by a plain modifier and is not planned by add actions', () => {
    const plain = addSourceModifier(build('base.akoyan-spear'), def('mod.local-critical-chance.t1'));
    const target = addRequirement(targetForSource(plain), 'mod.local-critical-chance.t1', true);
    const unmet = compareToTarget(plain, target, view);
    expect(unmet.rows[0]?.status).toBe('not-fractured');
    expect(unmet.matched).toBe(0);
    // Exalted-style actions only add plain modifiers: no stage chance is offered for a fracture.
    expect(outstandingTargetModifiers(unmet)).toEqual([]);

    const met = compareToTarget(setSourceModifierFractured(plain, 0, true), target, view);
    expect(met.rows[0]?.status).toBe('matched');
  });
});

describe('modifier pool follows the source base and item level', () => {
  const eligible = (source: ItemState, modifierId: string) => {
    const { pool } = poolForMode(session(source), db, { kind: 'edit-source' });
    if (pool?.status !== 'ready') throw new Error('expected a ready pool');
    return pool.entries.find((e) => e.definition.id === modifierId);
  };

  it('another base changes what is eligible', () => {
    // Critical Hit Chance weights: spear and bow 400–1000, everything else falls to `default: 0`.
    expect(eligible(build('base.akoyan-spear'), 'mod.local-critical-chance.t1')?.eligible).toBe(true);
    expect(eligible(build('base.recurve-bow'), 'mod.local-critical-chance.t1')?.eligible).toBe(true);
    expect(eligible(build('base.long-quarterstaff'), 'mod.local-critical-chance.t1')?.reasons).toContainEqual({
      code: 'not-spawnable-on-base',
      matchedTag: 'default',
    });
    // Arrow Speed is bow-only; Dexterity rolls on any weapon.
    expect(eligible(build('base.akoyan-spear'), 'mod.arrow-speed.t1')?.eligible).toBe(false);
    expect(eligible(build('base.recurve-bow'), 'mod.arrow-speed.t1')?.eligible).toBe(true);
    expect(eligible(build('base.long-quarterstaff'), 'mod.dexterity.t1')?.eligible).toBe(true);
  });

  it('quality and slots change nothing in the pool or the chances (no rule models them yet)', () => {
    const plain = build('base.akoyan-spear');
    const tuned = setSlotCount(view, setQuality(view, plain, 20), 'rune-socket', 1);
    const summary = (item: ItemState) => {
      const { pool } = poolForMode(session(item), db, { kind: 'inspect', actionId: 'action.add-random-modifier' });
      if (pool?.status !== 'ready') throw new Error('expected a ready pool');
      return { total: pool.totalKnownWeight, entries: pool.entries.map((e) => [e.definition.id, e.weight, e.eligible]) };
    };
    expect(summary(tuned)).toEqual(summary(plain));
  });

  it('a lower item level drops the tiers it does not reach', () => {
    // Critical Hit Chance T1 needs ilvl 73.
    expect(eligible(build('base.akoyan-spear', 82), 'mod.local-critical-chance.t1')?.eligible).toBe(true);
    expect(eligible(build('base.akoyan-spear', 70), 'mod.local-critical-chance.t1')?.reasons).toEqual([
      { code: 'item-level-too-low', required: 73, itemLevel: 70 },
    ]);
  });
});

describe('held tool → click on the current item', () => {
  it('selecting a tool changes what a click would do', () => {
    expect(resolveTool(view, EMPTY_TOOL).status).toBe('none');
    const exalt = resolveTool(view, EXALT);
    expect(exalt.status === 'ready' && exalt.action.id).toBe('action.add-random-modifier');
    const withOmen = resolveTool(view, toggleOmen(EXALT, 'omen.dextral-exaltation'));
    expect(withOmen.status === 'ready' && withOmen.action.id).toBe('action.add-random-suffix');
  });

  it('a click applies the selected action and spends its price', () => {
    const before = session();
    const after = click(before);
    expect(after.steps).toHaveLength(1);
    expect(after.steps[0]?.actionId).toBe('action.add-random-modifier');
    expect(after.current?.explicits).toHaveLength(2);
    expect(sessionSpent(after).total).toBe(0.25);
    expect(after.source).toBe(before.source);
  });

  it('a click with no tool or an unmodelled combination changes nothing and spends nothing', () => {
    const before = session();
    const none = applyToolStep(before, { db, tool: EMPTY_TOOL, prices: PRICES });
    expect(none).toMatchObject({ status: 'rejected', reason: 'no-tool' });
    expect(none.session).toBe(before);

    // No action spends Perfect Exalted Orb + Omen of Dextral Exaltation together.
    const odd = toggleOmen(selectCurrency(EMPTY_TOOL, 'currency.perfect-exalted-orb'), 'omen.dextral-exaltation');
    const unsupported = applyToolStep(before, { db, tool: odd, prices: PRICES });
    expect(unsupported).toMatchObject({ status: 'rejected', reason: 'unsupported-tool' });
    expect(unsupported.session).toBe(before);
  });

  it('a click the item cannot take (no free suffix) changes nothing and spends nothing', () => {
    let full = scenarioSource();
    for (const id of ['mod.local-attack-speed.t1', 'mod.dexterity.t1']) full = addSourceModifier(full, def(id));
    const before = session(full);
    const dextral = toggleOmen(EXALT, 'omen.dextral-exaltation');
    const result = applyToolStep(before, { db, tool: dextral, prices: PRICES });
    expect(result.status).toBe('rejected');
    expect(result.session).toBe(before);
    expect(sessionSpent(result.session).total).toBe(0);
  });
});
