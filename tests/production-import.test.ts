import { describe, expect, it } from 'vitest';
import { createCraftDb, productionDataset } from '@poe2-craft/craft-db';
import { parseItem } from '../packages/item-parser/src/resolve-item';
import { renderModifierText } from '../packages/craft-domain/src/index';
const view = createCraftDb(productionDataset).forVersion('0.5.5');
const copied = (name: string, lines: string) => `Item Class: Rings\nRarity: Rare\nTest Item\n${name}\n--------\nItem Level: 82\n--------\n${lines}`;
describe('production clipboard import', () => {
  it('resolves a base implicit, a fractured explicit and preserves an unknown line', () => {
    const base = view.findBaseByName('Topaz Ring')!;
    const implicit = view.getSpecialModifier(base.implicitModifierIds![0]!)!;
    const line = implicit.lines[0]!;
    const implicitText = line.template.replace('#',String(line.ranges[0]!.min));
    const def = view.listModifiers({baseId:base.id}).find((m) => m.layer === 'explicit' && m.lines.length === 1 && m.lines[0]!.template === '+# to maximum Life' && m.requiredItemLevel <= 82)!;
    const values = def.lines.flatMap((l) => l.ranges.map((r) => r.min+1));
    const result = parseItem(copied(base.name,`${implicitText} (implicit)\n--------\n${renderModifierText(def,values)} (fractured)\nA stat the catalog does not know`),view);
    expect(result.state.baseId).toBe(base.id);
    expect(result.state.otherLines.find((l) => l.source === 'implicit')?.modifierId).toBe(implicit.id);
    expect(result.state.explicits[0]).toMatchObject({kind:'resolved',modifierId:def.id,values,fractured:true});
    expect(result.state.explicits[1]).toMatchObject({kind:'unresolved',sourceText:'A stat the catalog does not know'});
    expect(view.tierOf(def.id,base.id)).toBeGreaterThan(0);
  });
  it('does not select the first ambiguous base and retains modifier text', () => {
    const base = view.findBaseByName('Topaz Ring')!;
    const catalog = {listBases:()=>[base,{...base,id:'ambiguous-copy'}],listModifiers:()=>view.listModifiers()};
    const result = parseItem(copied(base.name,'Unknown line'),catalog);
    expect(result.state.baseId).toBeNull(); expect(result.diagnostics.some((d) => d.code === 'base-ambiguous')).toBe(true);
    expect(result.state.explicits[0]?.sourceText).toBe('Unknown line');
  });
  it('renders and imports hybrid modifier values across multiple lines without placeholder loss', () => {
    const base = view.findBaseByName('Rusted Cuirass')!;
    const def = view.listModifiers({baseId:base.id}).find((m) => m.layer === 'explicit' && m.lines.length > 1 && m.lines.every((l) => l.ranges.length))!;
    const values = def.lines.flatMap((l) => l.ranges.map((r) => r.min));
    const text = renderModifierText(def,values); expect(text).not.toContain('#');
    const result = parseItem(copied(base.name,text),view);
    expect(result.state.explicits).toHaveLength(1);
    expect(result.state.explicits[0]).toMatchObject({kind:'resolved',modifierId:def.id,values});
  });
});
