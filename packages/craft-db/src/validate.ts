import { rangesOverlap, type Provenance, type VersionRange } from '@poe2-craft/craft-domain';
import type { CraftDataset } from './dataset';

interface Versioned {
  readonly id: string;
  readonly versions: VersionRange;
}

/**
 * Structural checks on a dataset. Returns human-readable problems; empty array = valid.
 * Catching broken references here keeps the engines free of defensive data checks.
 */
export function validateDataset(dataset: CraftDataset): string[] {
  const problems: string[] = [];
  const sourceIds = new Set(dataset.info.sources.map((s) => s.id));
  const classIds = new Set(dataset.itemClasses.map((c) => c.id));
  const groupIds = new Set(dataset.groups.map((g) => g.id));
  const modifierIds = new Set(dataset.modifiers.map((m) => m.id));
  const consumableIds = new Set(dataset.consumables.map((c) => c.id));

  const checkProvenance = (where: string, provenance: Provenance) => {
    if (!sourceIds.has(provenance.sourceId)) {
      problems.push(`${where}: unknown source "${provenance.sourceId}"`);
    }
  };

  checkRevisions('item class', dataset.itemClasses, problems);
  checkRevisions('base', dataset.bases, problems);
  checkRevisions('modifier', dataset.modifiers, problems);
  checkRevisions('action', dataset.actions, problems);
  checkRevisions('consumable', dataset.consumables, problems);

  for (const c of dataset.itemClasses) checkProvenance(`item class ${c.id}`, c.provenance);
  for (const g of dataset.groups) checkProvenance(`group ${g.id}`, g.provenance);

  for (const base of dataset.bases) {
    checkProvenance(`base ${base.id}`, base.provenance);
    if (!classIds.has(base.itemClassId)) {
      problems.push(`base ${base.id}: unknown item class "${base.itemClassId}"`);
    }
  }

  for (const mod of dataset.modifiers) {
    const where = `modifier ${mod.id}`;
    checkProvenance(where, mod.provenance);
    if (mod.groupIds.length === 0) problems.push(`${where}: has no modifier group`);
    for (const g of mod.groupIds) {
      if (!groupIds.has(g)) problems.push(`${where}: unknown group "${g}"`);
    }
    if (mod.lines.length === 0) problems.push(`${where}: has no lines`);
    for (const line of mod.lines) {
      const placeholders = (line.template.match(/#/g) ?? []).length;
      if (placeholders !== line.ranges.length) {
        problems.push(
          `${where}: template "${line.template}" has ${placeholders} "#" but ${line.ranges.length} ranges`,
        );
      }
      for (const r of line.ranges) {
        if (r.min > r.max) problems.push(`${where}: range ${r.min}..${r.max} is inverted`);
      }
    }
    for (const w of mod.spawnWeights) {
      if (w.weight !== null && (!Number.isFinite(w.weight) || w.weight < 0)) {
        problems.push(`${where}: invalid weight ${w.weight} for tag "${w.tag}"`);
      }
    }
  }

  for (const action of dataset.actions) {
    checkProvenance(`action ${action.id}`, action.provenance);
    for (const cost of action.defaultCost) {
      if (!consumableIds.has(cost.consumableId)) {
        problems.push(`action ${action.id}: unknown consumable "${cost.consumableId}"`);
      }
    }
  }

  for (const target of dataset.targets) {
    checkProvenance(`target ${target.id}`, target.provenance);
    if (target.modifierIds.length === 0) problems.push(`target ${target.id}: no modifiers`);
    for (const id of target.modifierIds) {
      if (!modifierIds.has(id)) problems.push(`target ${target.id}: unknown modifier "${id}"`);
    }
  }

  for (const rule of dataset.affixLimits) {
    checkProvenance(`affix limit ${rule.rarity}`, rule.provenance);
  }
  for (const c of dataset.consumables) checkProvenance(`consumable ${c.id}`, c.provenance);

  return problems;
}

/** The same id may appear several times only as non-overlapping revisions. */
function checkRevisions(kind: string, records: readonly Versioned[], problems: string[]): void {
  const byId = new Map<string, Versioned[]>();
  for (const record of records) {
    const list = byId.get(record.id) ?? [];
    for (const other of list) {
      if (rangesOverlap(other.versions, record.versions)) {
        problems.push(`${kind} ${record.id}: revisions with overlapping version ranges`);
      }
    }
    list.push(record);
    byId.set(record.id, list);
  }
}
