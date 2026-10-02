import { describe, expect, it } from 'vitest';
import { createCraftDb, productionDataset, akoyanSpearFixture } from '@poe2-craft/craft-db';
import { createItemState, renderModifierText } from '@poe2-craft/craft-domain';
import { calculateAttemptCost } from '@poe2-craft/economy';
import { applyAction, checkApplicable } from './apply-action';
import { createItemFromBase } from './item-setup';
import { createSession, applyToolStep, undoLastStep, redoStep, sessionSpent } from './session';
import { resolveTool } from './tools';
import { buildEligiblePool, calculateTargetProbability } from '@poe2-craft/probability-engine';

const db = createCraftDb(productionDataset), version = db.supportedVersions[0]!, view = db.forVersion(version);
const context = { gameVersion: version };
const base = view.findBaseByName('Topaz Ring')!;
const blank = createItemFromBase(view, base.id, 82)!;
function itemWithMods(count = 4) {
  const groups = new Set<string>();
  const defs = view.listModifiers({ baseId: base.id }).filter((m) => m.layer === 'explicit' && m.side === 'prefix' && m.lines.some((l) => l.ranges.length)).filter((m) => {
    if (m.groupIds.some((g) => groups.has(g))) return false;
    m.groupIds.forEach((g) => groups.add(g)); return true;
  }).slice(0, 3);
  const suffix = view.listModifiers({ baseId: base.id }).filter((m) => m.layer === 'explicit' && m.side === 'suffix' && !m.groupIds.some((g) => groups.has(g))).slice(0,1);
  return createItemState({ ...blank, explicits: [...defs,...suffix].slice(0,count).map((d) => {
    const values = d.lines.flatMap((l) => l.ranges.map((r) => r.min));
    return { kind:'resolved', modifierId:d.id, values, fractured:false, sourceText:renderModifierText(d,values) };
  }) });
}
describe('production operations', () => {
  it.each(['exalted','transmute','aug','regal','alch','chaos'])('%s refuses unknown weights before sampling and preserves all state', (id) => {
    const rarity = id === 'transmute' || id === 'alch' ? 'normal' : id === 'aug' || id === 'regal' ? 'magic' : 'rare';
    const item = createItemState({ ...(id === 'chaos' ? itemWithMods() : blank), rarity });
    const result = applyAction({ db, context, actionId:id, item, rng: () => { throw new Error('Rejected action sampled RNG'); } });
    expect(result.status).toBe('rejected');
    expect(result.item).toBe(item);
    if (result.status === 'rejected') expect(result.rejection.code).toBe('unknown-weights');
  });
  it('annul respects fractured modifiers and composed side restriction, records actual cost and exact undo/redo', () => {
    const source = itemWithMods();
    const item = createItemState({ ...source, explicits: source.explicits.map((m,i) => ({ ...m, fractured:i === 0 })) });
    const tool = { currencyId:'annul', omenIds:['omen-of-dextral-annulment'] };
    const resolved = resolveTool(view, tool);
    expect(resolved.status).toBe('ready');
    const session = createSession({ gameVersion:version, seed:42, source:item });
    const result = applyToolStep(session, { db, tool, prices:{ id:'test',unit:'div',source:'manual',capturedAt:'2026-10-02',prices:{ annul:2,'omen-of-dextral-annulment':3 } } });
    expect(result.status).toBe('applied');
    if (result.status !== 'applied') return;
    expect(result.session.current!.explicits).toHaveLength(3);
    expect(result.session.current!.explicits[0]).toEqual(item.explicits[0]);
    expect(result.session.current!.explicits.every((m) => m.kind === 'resolved' && view.getModifier(m.modifierId)?.side === 'prefix')).toBe(true);
    expect(result.step.added).toBeNull();
    expect(sessionSpent(result.session).total).toBe(5);
    const undone = undoLastStep(result.session);
    expect(undone.current).toBe(item); expect(sessionSpent(undone).total).toBe(0);
    expect(redoStep(undone).current).toBe(result.session.current);
  });
  it('fractures one of four modifiers, refuses another fracture and corrupted items', () => {
    const item = itemWithMods();
    const result = applyAction({ db,context,item,actionId:'fracturing-orb',rng:()=>0.999 });
    expect(result.status).toBe('applied');
    expect(result.item.explicits.filter((m) => m.fractured)).toHaveLength(1);
    const again = applyAction({ db,context,item:result.item,actionId:'fracturing-orb',rng:()=>0 });
    expect(again.status).toBe('rejected'); expect(again.item).toBe(result.item);
    expect(applyAction({ db,context,item:{ ...item,corrupted:true },actionId:'annul',rng:()=>0 }).status).toBe('rejected');
  });
  it('divine keeps ids, tiers and fractured values, changing only rolled explicit values', () => {
    const source=itemWithMods(); const item=createItemState({ ...source,explicits:source.explicits.map((m,i)=>({...m,fractured:i===0})) });
    const result=applyAction({ db,context,item,actionId:'divine',rng:()=>0.999 });
    expect(result.status).toBe('applied'); expect(result.item.explicits[0]).toEqual(item.explicits[0]);
    expect(result.item.explicits.map((m)=>m.kind==='resolved' && m.modifierId)).toEqual(item.explicits.map((m)=>m.kind==='resolved' && m.modifierId));
    expect(result.item.explicits.slice(1)).not.toEqual(item.explicits.slice(1));
  });
  it('composes greater exaltation and reports compound probability as indeterminate', () => {
    const tool=resolveTool(view,{ currencyId:'exalted',omenIds:['omen-of-greater-exaltation'] });
    expect(tool.status).toBe('ready'); if(tool.status!=='ready') return;
    expect(tool.action.effect).toMatchObject({kind:'operations',operations:[{kind:'add-random-mod',count:2}]});
    const pool=buildEligiblePool({db,context,item:blank,action:tool.action});
    expect(checkApplicable(pool)?.code).toBe('unknown-weights');
    expect(calculateTargetProbability(pool,{id:'x',label:'x',modifierIds:['IncreasedMana9'],provenance:productionDataset.modifiers[0]!.provenance})).toMatchObject({status:'indeterminate',reason:'compound-action'});
  });
  it('executes sequential add operations using known fixture weights and preserves group/slot limits', () => {
    const fixture=createCraftDb({ ...akoyanSpearFixture, actions:[...akoyanSpearFixture.actions,{ ...akoyanSpearFixture.actions[0]!,id:'ops',requirements:{rarities:['normal']},effect:{kind:'operations',operations:[{kind:'set-rarity',rarity:'rare'},{kind:'add-random-mod',count:4,allowedSides:['prefix','suffix']}]}}] });
    const v=fixture.forVersion('0.5.0'); const item=createItemState({...createItemFromBase(v,v.listBases()[0]!.id,82)!,rarity:'normal'});
    const result=applyAction({db:fixture,context:{gameVersion:'0.5.0'},item,actionId:'ops',rng:()=>0.4});
    expect(result.status).toBe('applied'); expect(result.item.rarity).toBe('rare');expect(result.item.explicits).toHaveLength(4);
  });
});
