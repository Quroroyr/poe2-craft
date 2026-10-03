import { describe, expect, it } from 'vitest';
import { extractModsView } from '../scripts/data/weights-fetch.ts';
import { assignTable, matchRow, ourNumbers, rowNumbers } from '../scripts/data/weights-normalize.ts';

// Shapes copied from a PoE2DB page (Body_Armours_str, 2026-10-03), trimmed to the fields we read.
const cell = (from: number, to: number, text: string) =>
  `<span class='mod-value'>+(${from}<span class="ndash">—</span>${to})</span>${text}`;
const row = (over: Record<string, unknown> = {}) => ({
  Name: 'of the Brute', Level: '1', ModGenerationTypeID: '2', ModFamilyList: ['Strength'], DropChance: '1000',
  str: cell(5, 8, ' to <a href="Strength">Strength</a>'), spawn_no: ['ring', 'str_armour', 'default'], ...over,
});
const mod = (id: string, over: Record<string, unknown> = {}) => ({
  id, name: 'of the Brute', side: 'suffix', layer: 'explicit', domain: 'item', family: 'Strength', groupIds: ['Strength'],
  requiredItemLevel: 1, lines: [{ template: '+# to Strength', ranges: [{ min: 5, max: 8 }] }],
  spawnWeights: [{ tag: 'str_armour', weight: null, spawns: true }], ...over,
});

describe('PoE2DB raw page parser', () => {
  it('extracts the ModsView object, including braces and quotes inside strings', () => {
    const html = `<script>$(function(){ new ModsView({"baseitem":{"href":"Rings"},"normal":[{"Name":"a } \\" {","DropChance":"500"}]}); });</script>`;
    expect(extractModsView(html)).toEqual({ baseitem: { href: 'Rings' }, normal: [{ Name: 'a } " {', DropChance: '500' }] });
    expect(extractModsView('<html>no table</html>')).toBeNull();
  });

  it('reads rolled numbers only from mod-value spans', () => {
    expect(rowNumbers(cell(5, 8, ' to Strength on level 20 items'))).toEqual([5, 8]);
    expect(ourNumbers(mod('Strength1'))).toEqual([5, 8]);
  });
});

describe('PoE2DB row → modifier mapping', () => {
  it('matches by side, level and affix name', () => {
    const result = matchRow(row(), [mod('Strength1'), mod('Strength2', { requiredItemLevel: 11 }), mod('Dex1', { side: 'prefix' })]);
    expect(result).toMatchObject({ status: 'matched', mod: { id: 'Strength1' } });
  });

  it('separates same-named modifiers by rolled numbers, then by spawn tags, then by family', () => {
    const byNumbers = [mod('A'), mod('B', { lines: [{ template: '+# to Strength', ranges: [{ min: 9, max: 12 }] }] })];
    expect(matchRow(row(), byNumbers)).toMatchObject({ status: 'matched', mod: { id: 'A' } });
    const byTags = [mod('A'), mod('B', { spawnWeights: [{ tag: 'str_dex_int_armour', weight: null, spawns: true }] })];
    expect(matchRow(row(), byTags)).toMatchObject({ status: 'matched', mod: { id: 'A' } });
    const byFamily = [mod('A'), mod('B', { groupIds: ['Other'], family: 'Other' })];
    expect(matchRow(row(), byFamily)).toMatchObject({ status: 'matched', mod: { id: 'A' } });
  });

  it('never guesses: identical candidates stay ambiguous, missing ones unmatched', () => {
    expect(matchRow(row(), [mod('A'), mod('B')])).toEqual({ status: 'ambiguous', ids: ['A', 'B'] });
    expect(matchRow(row({ Name: 'of Nothing' }), [mod('A')])).toEqual({ status: 'none' });
    expect(matchRow(row({ ModGenerationTypeID: '5' }), [mod('A')])).toEqual({ status: 'none' });
  });

  it('does not match by display text alone', () => {
    // Same text and numbers, different affix name and level: not the same modifier.
    expect(matchRow(row(), [mod('A', { name: 'of the Wrestler', requiredItemLevel: 11 })])).toEqual({ status: 'none' });
  });
});

describe('base → weight table', () => {
  const pages = [
    { page: 'Body_Armours_str', itemClassId: 'Body Armour', tag: 'str_armour' },
    { page: 'Body_Armours_str_dex', itemClassId: 'Body Armour', tag: 'str_dex_armour' },
    { page: 'Shields_str', itemClassId: 'Shield', tag: 'str_armour,str_shield' },
    { page: 'Rings', itemClassId: 'Ring', tag: null },
  ];
  const base = (itemClassId: string, tags: string[]) => ({ id: 'x', name: 'x', itemClassId, tags });
  it('takes the class page whose tags the base carries, the most specific one', () => {
    expect(assignTable(base('Body Armour', ['str_armour', 'body_armour']), pages)).toMatchObject({ page: 'Body_Armours_str' });
    expect(assignTable(base('Shield', ['str_armour', 'str_shield', 'shield']), pages)).toMatchObject({ page: 'Shields_str' });
    expect(assignTable(base('Ring', ['ring']), pages)).toMatchObject({ page: 'Rings' });
  });
  it('leaves a base without a fitting page unassigned, and refuses a tie', () => {
    expect(assignTable(base('Body Armour', ['str_dex_int_armour']), pages)).toBeNull();
    expect(assignTable(base('Belt', ['belt']), pages)).toBeNull();
    const tie = [...pages, { page: 'Other', itemClassId: 'Body Armour', tag: 'body_armour' }];
    expect(assignTable(base('Body Armour', ['str_armour', 'body_armour']), tie)).toBe('ambiguous');
  });
});
