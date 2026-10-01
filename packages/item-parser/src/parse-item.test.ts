import { describe, expect, it } from 'vitest';
import { akoyanSpearFixture, createCraftDb } from '@poe2-craft/craft-db';
import { parseItem, parseItemText } from './index';
import {
  AKOYAN_SPEAR_ADVANCED,
  AKOYAN_SPEAR_FOUR_MODS,
  AKOYAN_SPEAR_FRACTURED_CRIT,
  AKOYAN_SPEAR_UNKNOWN_LINE,
} from './fixtures/sample-items';

const catalog = createCraftDb(akoyanSpearFixture).forVersion('0.5.0');

const rareSpear = (mods: string) => `Item Class: Spears
Rarity: Rare
Test Name
Akoyan Spear
--------
Item Level: 82
--------
${mods}`;

describe('item parser', () => {
  it('recognises the base, class and rarity', () => {
    const { state, base } = parseItem(AKOYAN_SPEAR_FRACTURED_CRIT, catalog);
    expect(base?.id).toBe('base.akoyan-spear');
    expect(state.baseId).toBe('base.akoyan-spear');
    expect(state.baseName).toBe('Akoyan Spear');
    expect(state.itemClassName).toBe('Spears');
    expect(state.rarity).toBe('rare');
  });

  it('recognises the item level', () => {
    expect(parseItem(AKOYAN_SPEAR_FRACTURED_CRIT, catalog).state.itemLevel).toBe(82);
  });

  it('resolves a known modifier to its stable id and tier by value', () => {
    const { state } = parseItem(AKOYAN_SPEAR_FOUR_MODS, catalog);
    expect(state.explicits.map((m) => (m.kind === 'resolved' ? m.modifierId : m.kind))).toEqual([
      'mod.local-physical-percent.t1',
      'mod.local-flat-physical.t1',
      'mod.local-critical-chance.t1',
      'mod.local-attack-speed.t1',
    ]);
    const flat = state.explicits[1];
    expect(flat?.kind === 'resolved' && flat.values).toEqual([18, 30]);
  });

  it('detects the fractured modifier', () => {
    const { state, parsed } = parseItem(AKOYAN_SPEAR_FRACTURED_CRIT, catalog);
    expect(state.explicits).toHaveLength(1);
    expect(state.explicits[0]).toMatchObject({
      kind: 'resolved',
      modifierId: 'mod.local-critical-chance.t1',
      fractured: true,
      values: [4.12],
    });
    expect(parsed.flags.fracturedItem).toBe(true);
  });

  it('keeps an unknown line as unresolved instead of failing', () => {
    const { state, diagnostics } = parseItem(AKOYAN_SPEAR_UNKNOWN_LINE, catalog);
    expect(state.explicits).toHaveLength(2);
    expect(state.explicits[1]).toMatchObject({
      kind: 'unresolved',
      reason: 'no-matching-definition',
      sourceText: '+1 to Maximum Fixture Charges',
    });
    expect(diagnostics).toContainEqual({
      code: 'unresolved-modifier',
      text: '+1 to Maximum Fixture Charges',
      reason: 'no-matching-definition',
    });
  });

  it('marks a known text with out-of-range values and keeps side/group hints', () => {
    const { state } = parseItem(rareSpear('+9.99% to Critical Hit Chance'), catalog);
    expect(state.explicits[0]).toMatchObject({
      kind: 'unresolved',
      reason: 'value-out-of-range',
      sideHint: 'suffix',
      groupIdsHint: ['group.local-critical-chance'],
    });
  });

  it('does not throw on arbitrary text', () => {
    const result = parseItem('hello world', catalog);
    expect(result.state.baseId).toBeNull();
    expect(result.state.itemLevel).toBeNull();
    expect(result.parsed.warnings.length).toBeGreaterThan(0);
    expect(() => parseItem('', catalog)).not.toThrow();
  });

  it('matches a multi-line hybrid only when its ranges fit', () => {
    const hybrid = parseItem(rareSpear('30% increased Physical Damage\n+100 to Accuracy Rating'), catalog);
    expect(hybrid.state.explicits).toEqual([
      expect.objectContaining({ modifierId: 'mod.local-physical-accuracy-hybrid.t1', values: [30, 100] }),
    ]);

    const separate = parseItem(rareSpear('98% increased Physical Damage\n+100 to Accuracy Rating'), catalog);
    expect(separate.state.explicits.map((m) => m.kind === 'resolved' && m.modifierId)).toEqual([
      'mod.local-physical-percent.t1',
      'mod.local-accuracy.t2',
    ]);
  });

  it('reads the advanced (Ctrl+Alt+C) format', () => {
    const { state } = parseItem(AKOYAN_SPEAR_ADVANCED, catalog);
    expect(state.explicits).toEqual([
      expect.objectContaining({ modifierId: 'mod.local-physical-percent.t2', values: [72], fractured: false }),
      expect.objectContaining({ modifierId: 'mod.local-critical-chance.t1', values: [4.12], fractured: true }),
    ]);
  });

  it('finds the base inside a magic item name and keeps implicits apart', () => {
    const text = `Item Class: Spears
Rarity: Magic
Heavy Akoyan Spear of Needling
--------
Item Level: 40
--------
+10 to Fixture Implicit (implicit)
--------
45% increased Physical Damage
+1.20% to Critical Hit Chance`;
    const { state } = parseItem(text, catalog);
    expect(state.baseId).toBe('base.akoyan-spear');
    expect(state.rarity).toBe('magic');
    expect(state.otherLines).toEqual([{ source: 'implicit', text: '+10 to Fixture Implicit' }]);
    expect(state.explicits).toHaveLength(2);
  });

  it('separates text reading from game data', () => {
    const parsed = parseItemText(AKOYAN_SPEAR_FOUR_MODS);
    expect(parsed.itemLevel).toBe(82);
    expect(parsed.explicitLines.map((l) => l.text)).toContain('+4.12% to Critical Hit Chance');
  });

  it('produces a frozen ItemState', () => {
    const { state } = parseItem(AKOYAN_SPEAR_FRACTURED_CRIT, catalog);
    expect(Object.isFrozen(state)).toBe(true);
    expect(Object.isFrozen(state.explicits[0])).toBe(true);
  });
});
