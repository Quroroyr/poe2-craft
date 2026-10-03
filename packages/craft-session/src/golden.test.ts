/// <reference types="node" />
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createCraftDb, productionDataset } from '@poe2-craft/craft-db';
import { buildEligiblePool } from '@poe2-craft/probability-engine';
import { createItemFromBase } from './item-setup';
import { MANUAL_EDIT_ACTION } from './editing';

const db = createCraftDb(productionDataset);
const directory = new URL('../../craft-db/src/production/golden/', import.meta.url);
describe('golden applicability (RePoE mods_by_base) and weights (raw PoE2DB page)', () => {
  for (const file of readdirSync(directory).filter((f) => f.endsWith('.json'))) {
    const golden = JSON.parse(readFileSync(new URL(file, directory), 'utf8'));
    it(golden.name, () => {
      const view = db.forVersion(golden.gameVersion);
      const base = view.getBase(golden.baseId)!;
      expect(base.details).toEqual(golden.details);
      expect(base.implicitModifierIds).toEqual(golden.implicitModifierIds);
      const item = createItemFromBase(view, base.id, golden.itemLevel)!;
      const pool = buildEligiblePool({ db, context: { gameVersion: golden.gameVersion }, item, action: MANUAL_EDIT_ACTION });
      expect(pool.status).toBe('ready');
      if (pool.status !== 'ready') return;
      expect(pool.eligible.map((e) => ({ id: e.definition.id, side: e.definition.side, family: e.definition.family,
        tier: e.tier, level: e.definition.requiredItemLevel, groups: e.definition.groupIds, weight: e.weight })).sort((a,b) => a.id.localeCompare(b.id))).toEqual(golden.eligible);
      // Totals over the pool our engine builds = totals the golden script read from the raw page.
      const total = (side?: string) => pool.eligible.filter((e) => !side || e.definition.side === side).reduce((sum, e) => sum + (e.weight ?? 0), 0);
      expect({ total: total(), prefixTotal: total('prefix'), suffixTotal: total('suffix'), unknown: [...pool.unknownWeightModifierIds].sort() })
        .toEqual({ total: golden.weights.total, prefixTotal: golden.weights.prefixTotal, suffixTotal: golden.weights.suffixTotal, unknown: golden.weights.unknown });
      expect(base.weightTableId).toBe(`poe2db:${golden.weights.page}`);
      expect(pool.eligible.filter((e) => e.weight !== null).every((e) => e.weightEvidence?.sourceId === 'poe2db-weightings' &&
        e.weightEvidence.confidence === 'community' && e.weightEvidence.method === 'recombinator-observation' && e.weightEvidence.rawValue === String(e.weight))).toBe(true);
      expect(pool.eligible.filter((e) => e.weight === null).every((e) => e.weightEvidence === undefined)).toBe(true);
      const first = pool.eligible.find((e) => pool.eligible.some((other) => other.definition.id !== e.definition.id && other.definition.groupIds.some((g) => e.definition.groupIds.includes(g))))!;
      const occupied = { ...item, explicits: [{ kind: 'resolved' as const, modifierId: first.definition.id, values: [], fractured: true, sourceText: '' }] };
      const blocked = buildEligiblePool({ db, context: { gameVersion: golden.gameVersion }, item: occupied, action: MANUAL_EDIT_ACTION });
      if (blocked.status !== 'ready') throw new Error('Occupied pool blocked');
      expect(blocked.entries.filter((e) => e.definition.groupIds.some((g) => first.definition.groupIds.includes(g))).every((e) => e.reasons.some((r) => r.code === 'group-already-on-item'))).toBe(true);
    });
  }
});
