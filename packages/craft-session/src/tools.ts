import type {
  Consumable,
  ConsumableCategory,
  ConsumableId,
  CraftAction,
} from '@poe2-craft/craft-domain';
import type { CraftDbView } from '@poe2-craft/craft-db';

/**
 * The crafting tool the user holds: one base consumable (an orb) plus optional modifiers
 * (omens). Clicking the current item applies the CraftAction this combination stands for.
 */
export interface ToolSelection {
  readonly currencyId: ConsumableId | null;
  readonly omenIds: readonly ConsumableId[];
}

export const EMPTY_TOOL: ToolSelection = { currencyId: null, omenIds: [] };

export type ResolvedTool =
  | { readonly status: 'ready'; readonly action: CraftAction; readonly consumables: readonly Consumable[] }
  | { readonly status: 'none' }
  /** Valid consumables, but no implemented action spends exactly this combination. */
  | { readonly status: 'unsupported'; readonly consumables: readonly Consumable[] };

export interface ToolPalette {
  /** Only consumables that some implemented action spends; nothing is offered without a model. */
  readonly byCategory: Readonly<Partial<Record<ConsumableCategory, readonly Consumable[]>>>;
}

/** Consumables that appear in the cost of at least one implemented action, grouped by category. */
export function toolPalette(view: CraftDbView): ToolPalette {
  const used = new Set(view.listActions().flatMap((a) => a.defaultCost.map((c) => c.consumableId)));
  const byCategory: Partial<Record<ConsumableCategory, Consumable[]>> = {};
  for (const consumable of view.listConsumables()) {
    if (!used.has(consumable.id)) continue;
    (byCategory[consumable.category] ??= []).push(consumable);
  }
  return { byCategory };
}

export function selectCurrency(tool: ToolSelection, currencyId: ConsumableId): ToolSelection {
  return { ...tool, currencyId: tool.currencyId === currencyId ? null : currencyId };
}

/** Toggles an omen. Omens of the same kind are not combined here: one omen at a time for now. */
export function toggleOmen(tool: ToolSelection, omenId: ConsumableId): ToolSelection {
  return { ...tool, omenIds: tool.omenIds.includes(omenId) ? [] : [omenId] };
}

/**
 * Finds the action whose consumables are exactly the selected ones. The pairing is data
 * (each action lists what it spends), so no combination is invented here.
 */
export function resolveTool(view: CraftDbView, tool: ToolSelection): ResolvedTool {
  if (!tool.currencyId) return { status: 'none' };
  const selected = [tool.currencyId, ...tool.omenIds];
  const consumables = selected.flatMap((id) => view.getConsumable(id) ?? []);
  const key = [...selected].sort().join('|');
  const action = view
    .listActions()
    .find((a) => a.defaultCost.map((c) => c.consumableId).sort().join('|') === key);
  return action ? { status: 'ready', action, consumables } : { status: 'unsupported', consumables };
}

/** The selection that corresponds to an action (e.g. to show which tool a history step used). */
export function toolForAction(view: CraftDbView, action: CraftAction): ToolSelection {
  const ids = action.defaultCost.map((c) => c.consumableId);
  const currencyId = ids.find((id) => view.getConsumable(id)?.category === 'currency') ?? null;
  return { currencyId, omenIds: ids.filter((id) => view.getConsumable(id)?.category === 'omen') };
}
