import type {
  Consumable,
  ConsumableCategory,
  ConsumableId,
  CraftAction,
} from '@poe2-craft/craft-domain';
import type { CraftDbView } from '@poe2-craft/craft-db';

/**
 * The crafting tool the user holds: one primary consumable (an orb, essence, catalyst or rune)
 * plus optional omens that modify it. Clicking the current item applies the CraftAction this
 * combination stands for. Switching the primary consumable keeps the omens: they stay held until
 * the user removes them.
 */
export interface ToolSelection {
  readonly currencyId: ConsumableId | null;
  readonly omenIds: readonly ConsumableId[];
}

export const EMPTY_TOOL: ToolSelection = { currencyId: null, omenIds: [] };

export type ResolvedTool =
  | { readonly status: 'ready'; readonly action: CraftAction; readonly consumables: readonly Consumable[] }
  /** No primary consumable held. Omens already picked wait here for one. */
  | { readonly status: 'none'; readonly omens: readonly Consumable[] }
  /** A held omen does not apply to the held consumable (by the omen's scope data). */
  | {
      readonly status: 'incompatible';
      readonly consumables: readonly Consumable[];
      readonly incompatibleOmenIds: readonly ConsumableId[];
    }
  /** Compatible as far as the data knows, but no implemented action spends exactly this combination. */
  | { readonly status: 'unsupported'; readonly consumables: readonly Consumable[] };

export interface ToolPalette {
  /** Every known consumable of this game version, grouped by category, in data order. */
  readonly byCategory: Readonly<Partial<Record<ConsumableCategory, readonly Consumable[]>>>;
  /** Consumables spent by at least one implemented action; every other tool is shown as not modelled. */
  readonly modelled: ReadonlySet<ConsumableId>;
}

/**
 * All consumables, grouped by category, plus which of them some implemented action spends.
 * Listing a consumable never makes it do anything: clicking with an unmodelled tool is refused.
 */
export function toolPalette(view: CraftDbView): ToolPalette {
  const modelled = new Set(view.listActions().flatMap((a) => a.defaultCost.map((c) => c.consumableId)));
  const byCategory: Partial<Record<ConsumableCategory, Consumable[]>> = {};
  for (const consumable of view.listConsumables()) {
    (byCategory[consumable.category] ??= []).push(consumable);
  }
  return { byCategory, modelled };
}

/** Takes (or puts back) the primary consumable. Held omens are kept either way. */
export function selectCurrency(tool: ToolSelection, currencyId: ConsumableId): ToolSelection {
  return { ...tool, currencyId: tool.currencyId === currencyId ? null : currencyId };
}

/** Toggles an omen. Omens of the same kind are not combined here: one omen at a time for now. */
export function toggleOmen(tool: ToolSelection, omenId: ConsumableId): ToolSelection {
  return { ...tool, omenIds: tool.omenIds.includes(omenId) ? [] : [omenId] };
}

export function clearOmens(tool: ToolSelection): ToolSelection {
  return { ...tool, omenIds: [] };
}

/** Picks a palette tile: omens toggle as modifiers, everything else becomes the primary consumable. */
export function pickTool(tool: ToolSelection, consumable: Consumable): ToolSelection {
  return consumable.category === 'omen' ? toggleOmen(tool, consumable.id) : selectCurrency(tool, consumable.id);
}

/**
 * Finds the action whose consumables are exactly the selected ones. The pairing is data
 * (each action lists what it spends), so no combination is invented here. Before that, an omen
 * whose scope excludes the held consumable makes the combination incompatible.
 */
export function resolveTool(view: CraftDbView, tool: ToolSelection): ResolvedTool {
  const omens = tool.omenIds.flatMap((id) => view.getConsumable(id) ?? []);
  if (!tool.currencyId) return { status: 'none', omens };
  const primary = view.getConsumable(tool.currencyId);
  const consumables = [...(primary ? [primary] : []), ...omens];

  const incompatibleOmenIds = omens
    .filter((omen) => omen.modifies !== undefined && !omen.modifies.consumableIds.includes(tool.currencyId ?? ''))
    .map((omen) => omen.id);
  if (incompatibleOmenIds.length > 0) return { status: 'incompatible', consumables, incompatibleOmenIds };

  const key = [tool.currencyId, ...tool.omenIds].sort().join('|');
  const action = view
    .listActions()
    .find((a) => a.defaultCost.map((c) => c.consumableId).sort().join('|') === key);
  return action ? { status: 'ready', action, consumables } : { status: 'unsupported', consumables };
}

/** The selection that corresponds to an action (e.g. to show which tool a history step used). */
export function toolForAction(view: CraftDbView, action: CraftAction): ToolSelection {
  const ids = action.defaultCost.map((c) => c.consumableId);
  const currencyId = ids.find((id) => view.getConsumable(id)?.category !== 'omen') ?? null;
  return { currencyId, omenIds: ids.filter((id) => view.getConsumable(id)?.category === 'omen') };
}
