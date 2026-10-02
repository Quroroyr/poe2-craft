import {
  createItemState,
  sameDomain,
  isSpawnable,
  resolveSpawnWeight,
  type ItemBase,
  type ItemState,
  type ModifierDefinition,
  type UnresolvedReason,
  type SpecialModifierDefinition,
} from '@poe2-craft/craft-domain';
import { matchExplicitLines, matchTemplate } from './modifier-matcher';
import { parseItemText, type ParsedItemText } from './parse-item-text';

/**
 * What the parser needs from game data. Declared here (not imported from craft-db)
 * so the parser depends only on the domain; a CraftDbView satisfies it structurally.
 */
export interface ItemCatalog {
  listBases(): readonly ItemBase[];
  listModifiers(): readonly ModifierDefinition[];
  listSpecialModifiers?(): readonly SpecialModifierDefinition[];
  tierOf?(id: string, baseId: string | null): number;
}

export type ParseDiagnostic =
  | { readonly code: 'base-ambiguous'; readonly nameLines: readonly string[] }
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

  const found = findBases(parsed.nameLines, catalog.listBases());
  const ambiguous = found.length > 1 || found.some((b) => b.ambiguousName);
  const base = !ambiguous ? found[0] ?? null : null;
  if (ambiguous) diagnostics.push({ code: 'base-ambiguous', nameLines: parsed.nameLines });
  if (!base && parsed.nameLines.length > 0) {
    diagnostics.push({ code: 'base-not-in-catalog', nameLines: parsed.nameLines });
  }
  if (parsed.flags.unidentified) diagnostics.push({ code: 'unidentified-item' });

  const explicits = matchExplicitLines(
    parsed.explicitLines,
    catalog.listModifiers().filter((m) => !base || sameDomain(m.domain, base.domain)),
    base ? { baseTags: base.tags, tierOf: (id) => catalog.tierOf?.(id, base.id) ?? catalog.listModifiers().find((m) => m.id === id)?.tier ?? 0 } : {},
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
    quality: parsed.quality,
    // The game lists sockets on weapons and armour as rune sockets ("S"); other kinds come later.
    slots: parsed.socketCount === null ? [] : [{ kind: 'rune-socket', count: parsed.socketCount }],
    explicits,
    otherLines: parsed.otherLines.map((l) => {
      if (!base || !catalog.listSpecialModifiers?.().length || (l.source !== 'implicit' && l.source !== 'enchant')) return { source: l.source, text: l.text };
      const text = l.text.replace(/\s*\((implicit|enchant)\)$/i, '');
      const candidates = (catalog.listSpecialModifiers?.() ?? []).filter((m) => m.lines.length === 1 && (l.source === 'implicit' ? base.implicitModifierIds?.includes(m.id) : m.layer === 'corruption' && sameDomain(m.domain, base.domain) && isSpawnable(resolveSpawnWeight(m, base.tags)))).flatMap((m) => {
        const values = matchTemplate(text, m.lines[0]!.template);
        return values && m.lines[0]!.ranges.every((r, i) => values[i]! >= r.min && values[i]! <= r.max) ? [{ m, values }] : [];
      });
      const only = candidates.length === 1 ? candidates[0] : undefined;
      return { source: l.source, text: l.text, ...(only ? { modifierId: only.m.id, values: only.values } : { unresolvedReason: candidates.length > 1 ? 'ambiguous' as const : 'no-matching-definition' as const }) };
    }),
    corrupted: parsed.flags.corrupted,
  });

  return { state, parsed, base, diagnostics };
}

/**
 * Rare/unique items list the base on its own line; magic and normal items embed it in
 * the name ("Superior Akoyan Spear", "Heavy Akoyan Spear of Needling"). Exact line
 * matches win; otherwise the longest base name contained in a line, on word boundaries.
 */
function findBases(nameLines: readonly string[], bases: readonly ItemBase[]): ItemBase[] {
  const lower = nameLines.map((l) => l.toLowerCase());
  const exact = bases.filter((b) => lower.includes(b.name.toLowerCase()));
  if (exact.length) return exact;

  const byLength = [...bases].sort((a, b) => b.name.length - a.name.length);
  for (const base of byLength) {
    const pattern = new RegExp(`(^|\\s)${escapeRegex(base.name.toLowerCase())}(\\s|$)`);
    if (lower.some((line) => pattern.test(line))) return bases.filter((b) => b.name === base.name);
  }
  return [];
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
