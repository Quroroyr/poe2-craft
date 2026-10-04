import type {
  ActionModifier,
  CraftActionRequirements,
  Consumable,
  CraftAction,
  CraftSupportStatus,
  ItemState,
  Provenance,
} from '@poe2-craft/craft-domain';
import type { CraftDbView } from '@poe2-craft/craft-db';
import { toolBlock, type ToolBlock, type ToolPalette } from './tools';

/**
 * What a palette tool does, for the info popup (right click on a tile). Built only from data the
 * planner already has — `Consumable.mechanicNotes`, the description of the action that spends it,
 * `modifies`, `actionModifiers`, action requirements, `craftStatus`, provenance — never from a
 * second hand-written list of mechanics. Unknown stays unknown: a tool without a description says so.
 */
export interface ToolInfo {
  readonly consumable: Consumable;
  /** modelled / verified when an implemented action uses it; otherwise the data's own status. */
  readonly status: CraftSupportStatus;
  /** Readable effect text (the game's description without markup and usage hints); null when the data has none. */
  readonly effect: string | null;
  /** Remarks of the model kept apart from the effect, e.g. "… a community model, not independently verified." */
  readonly modelNote: string | null;
  /** Where the description comes from, e.g. "RePoE client 4.5.5.2 · base_items.json". */
  readonly descriptionSource: string | null;
  /** Requirements of the action the tool applies on its own (currencies); null for omens and unmodelled tools. */
  readonly requirements: CraftActionRequirements | null;
  /** Omens: the consumables they modify. Empty when the data does not say. */
  readonly worksWith: readonly Consumable[];
  /** Omens: how they change the next action, as data (shown as readable lines by the page). */
  readonly actionModifiers: readonly ActionModifier[];
  /** Against the current item: null = applicable, otherwise why not. Absent for omens and unmodelled tools. */
  readonly block?: ToolBlock | null;
  readonly provenance: Provenance;
}

export function toolInfo(view: CraftDbView, palette: ToolPalette, consumable: Consumable, item: ItemState | null): ToolInfo {
  const modelled = palette.modelled.has(consumable.id);
  const status: CraftSupportStatus = modelled
    ? consumable.craftStatus === 'verified' ? 'verified' : 'modelled'
    : (consumable.craftStatus ?? 'catalogued');
  const isOmen = consumable.category === 'omen';
  const own = ownAction(view, consumable.id);
  const text = consumable.mechanicNotes ?? (isOmen ? omenAction(view, consumable.id) : own)?.description ?? null;
  const parsed = text ? splitDescription(text, consumable.name) : null;
  const worksWith = (consumable.modifies?.consumableIds ?? []).flatMap((id) => view.getConsumable(id) ?? []);
  return {
    consumable,
    status,
    effect: parsed?.effect || null,
    modelNote: parsed?.modelNote ?? null,
    descriptionSource: parsed?.source ?? null,
    requirements: !isOmen && own ? own.requirements : null,
    worksWith,
    actionModifiers: consumable.actionModifiers ?? [],
    ...(!isOmen && modelled ? { block: toolBlock(view, consumable, item) } : {}),
    provenance: consumable.provenance,
  };
}

/** The action that spends only this consumable. */
function ownAction(view: CraftDbView, consumableId: string): CraftAction | undefined {
  return view.listActions().find((a) => a.defaultCost.length === 1 && a.defaultCost[0]?.consumableId === consumableId);
}

/** An action that spends this omen with a currency (demo data describes omens there). */
function omenAction(view: CraftDbView, omenId: string): CraftAction | undefined {
  return view.listActions().find((a) => a.defaultCost.length > 1 && a.defaultCost.some((c) => c.consumableId === omenId));
}

const SOURCE_PREFIXES: readonly [RegExp, (m: RegExpMatchArray) => string][] = [
  [/^Pinned RePoE client ([\d.]+), ([\w.]+), [^.]+\.\s*/, (m) => `RePoE client ${m[1]} · ${m[2]}`],
  [/^Pinned RePoE ([\w.]+):\s*/, (m) => `RePoE · ${m[1]}`],
];
const USAGE_HINT = /\s*Right click this item then left click [^.]*?to apply it\.?/gi;
const MODEL_NOTE = /\s*([^.]*\bcommunity model\b[^.]*\.)\s*$/i;

/**
 * Splits a stored description into the game's effect text, a remark of the model and its source.
 * "[ItemRarity|Rare]" markup becomes "Rare", the usage hint ("Right click this item …") is dropped,
 * and sentences cut by it get their full stop back.
 */
export function splitDescription(text: string, name: string): { effect: string; modelNote: string | null; source: string | null } {
  let rest = text.replace(/\s+/g, ' ').trim();
  let source: string | null = null;
  for (const [pattern, label] of SOURCE_PREFIXES) {
    const m = rest.match(pattern);
    if (m) {
      source = label(m);
      rest = rest.slice(m[0].length);
      break;
    }
  }
  let modelNote: string | null = null;
  const note = rest.match(MODEL_NOTE);
  if (note) {
    modelNote = note[1]!.trim();
    rest = rest.slice(0, note.index);
  }
  const effect = rest
    .replace(/\[[^\]|]+\|([^\]]+)\]/g, '$1')
    .replace(USAGE_HINT, '. ')
    .replace(new RegExp(`^${escapeRegExp(name)}\\.\\s*`), '')
    .replace(/\s*\.\s*\./g, '.')
    .replace(/\s+\./g, '.')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return { effect: effect && !/[.!?]$/.test(effect) ? `${effect}.` : effect, modelNote, source };
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
