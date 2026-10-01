import {
  createItemState,
  type ItemBase,
  type ItemState,
  type ModifierDefinition,
  type UnresolvedReason,
} from '@poe2-craft/craft-domain';
import { matchExplicitLines } from './modifier-matcher';
import { parseItemText, type ParsedItemText } from './parse-item-text';

/**
 * What the parser needs from game data. Declared here (not imported from craft-db)
 * so the parser depends only on the domain; a CraftDbView satisfies it structurally.
 */
export interface ItemCatalog {
  listBases(): readonly ItemBase[];
  listModifiers(): readonly ModifierDefinition[];
}

export type ParseDiagnostic =
  | { readonly code: 'text-warning'; readonly message: string }
  | { readonly code: 'base-not-in-catalog'; readonly nameLines: readonly string[] }
  | { readonly code: 'unidentified-item' }
  | { readonly code: 'unresolved-modifier'; readonly text: string; readonly reason: UnresolvedReason };

export interface ItemParseResult {
  readonly state: ItemState;
  readonly parsed: ParsedItemText;
  readonly base: ItemBase | null;
  readonly diagnostics: readonly ParseDiagnostic[];
}

export function parseItem(text: string, catalog: ItemCatalog): ItemParseResult {
  return resolveItem(parseItemText(text), catalog);
}

export function resolveItem(parsed: ParsedItemText, catalog: ItemCatalog): ItemParseResult {
  const diagnostics: ParseDiagnostic[] = parsed.warnings.map((message) => ({
    code: 'text-warning' as const,
    message,
  }));

  const base = findBase(parsed.nameLines, catalog.listBases());
  if (!base && parsed.nameLines.length > 0) {
    diagnostics.push({ code: 'base-not-in-catalog', nameLines: parsed.nameLines });
  }
  if (parsed.flags.unidentified) diagnostics.push({ code: 'unidentified-item' });

  const explicits = matchExplicitLines(
    parsed.explicitLines,
    catalog.listModifiers(),
    base ? { baseTags: base.tags } : {},
  );
  for (const m of explicits) {
    if (m.kind === 'unresolved') {
      diagnostics.push({ code: 'unresolved-modifier', text: m.sourceText, reason: m.reason });
    }
  }

  const state = createItemState({
    baseId: base?.id ?? null,
    baseName: base?.name ?? parsed.nameLines.at(-1) ?? null,
    itemClassName: parsed.itemClass,
    rarity: parsed.rarity,
    itemLevel: parsed.itemLevel,
    explicits,
    otherLines: parsed.otherLines.map((l) => ({ source: l.source, text: l.text })),
    corrupted: parsed.flags.corrupted,
  });

  return { state, parsed, base, diagnostics };
}

/**
 * Rare/unique items list the base on its own line; magic and normal items embed it in
 * the name ("Superior Akoyan Spear", "Heavy Akoyan Spear of Needling"). Exact line
 * matches win; otherwise the longest base name contained in a line, on word boundaries.
 */
function findBase(nameLines: readonly string[], bases: readonly ItemBase[]): ItemBase | null {
  const lower = nameLines.map((l) => l.toLowerCase());
  const exact = bases.find((b) => lower.includes(b.name.toLowerCase()));
  if (exact) return exact;

  const byLength = [...bases].sort((a, b) => b.name.length - a.name.length);
  for (const base of byLength) {
    const pattern = new RegExp(`(^|\\s)${escapeRegex(base.name.toLowerCase())}(\\s|$)`);
    if (lower.some((line) => pattern.test(line))) return base;
  }
  return null;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
