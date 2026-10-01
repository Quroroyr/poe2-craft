import type { AffixSide, Rarity } from '@poe2-craft/craft-domain';

/** Header of an advanced-copy (Ctrl+Alt+C) modifier, e.g. `{ Suffix Modifier "of Puncturing" (Tier: 1) — Critical }`. */
export interface AdvancedModifierHeader {
  readonly side?: AffixSide;
  readonly affixName?: string;
  readonly tier?: number;
  readonly fractured: boolean;
  /** Set when the header marks a non-explicit block, e.g. `{ Implicit Modifier }`. */
  readonly otherSource?: OtherLineSource;
}

export interface ParsedModifierLine {
  /** Text with value ranges and trailing annotations like "(fractured)" removed. */
  readonly text: string;
  readonly raw: string;
  readonly fractured: boolean;
  /** Lines under the same advanced header share one header object and one `blockId`. */
  readonly header?: AdvancedModifierHeader;
  readonly blockId?: number;
}

export type OtherLineSource = 'implicit' | 'rune' | 'enchant';

export interface ParsedOtherLine {
  readonly source: OtherLineSource;
  readonly text: string;
}

/**
 * Purely textual reading of a Ctrl+C item. No game data involved — matching lines to
 * modifier definitions happens in resolve-item.ts against a catalog.
 */
export interface ParsedItemText {
  readonly itemClass: string | null;
  readonly rarity: Rarity | null;
  /** Lines of the first section after "Item Class"/"Rarity": item name and/or base name. */
  readonly nameLines: readonly string[];
  readonly itemLevel: number | null;
  readonly explicitLines: readonly ParsedModifierLine[];
  readonly otherLines: readonly ParsedOtherLine[];
  readonly flags: {
    readonly corrupted: boolean;
    readonly fracturedItem: boolean;
    readonly unidentified: boolean;
    readonly mirrored: boolean;
  };
  readonly warnings: readonly string[];
}

const SEPARATOR = /^-{4,}$/;
const KEY_VALUE = /^[A-Z][A-Za-z' ]*:\s*\S/;
const ANNOTATION = /\s*\((implicit|fractured|rune|enchant|crafted|augmented|desecrated|unscalable value)\)\s*$/i;
const ADVANCED_RANGE = /(\d+(?:\.\d+)?)\(-?\d+(?:\.\d+)?-\d+(?:\.\d+)?\)/g;
const ADVANCED_HEADER = /^\{\s*(.*?)\s*\}$/;
const RARITIES: Record<string, Rarity> = {
  normal: 'normal',
  magic: 'magic',
  rare: 'rare',
  unique: 'unique',
};
const FLAG_LINES = new Set(['corrupted', 'fractured item', 'unidentified', 'mirrored']);

export function parseItemText(input: string): ParsedItemText {
  const warnings: string[] = [];
  const sections = splitSections(input);

  let itemClass: string | null = null;
  let rarity: Rarity | null = null;
  let itemLevel: number | null = null;
  const nameLines: string[] = [];
  const flagSet = new Set<string>();

  const header = sections[0] ?? [];
  for (const line of header) {
    const classMatch = /^Item Class:\s*(.+)$/i.exec(line);
    const rarityMatch = /^Rarity:\s*(.+)$/i.exec(line);
    if (classMatch?.[1]) itemClass = classMatch[1].trim();
    else if (rarityMatch?.[1]) {
      rarity = RARITIES[rarityMatch[1].trim().toLowerCase()] ?? null;
      if (!rarity) warnings.push(`Unknown rarity "${rarityMatch[1].trim()}"`);
    } else nameLines.push(line);
  }
  if (sections.length === 0) warnings.push('Empty input');
  else if (!itemClass && !rarity) {
    warnings.push('No "Item Class"/"Rarity" header: text may not be a PoE 2 item copy');
  }

  // Everything after the "Item Level" section is where modifiers live; before it are
  // properties, requirements and sockets. Without an item level line, fall back to all sections.
  let modifierSectionsStart = 1;
  sections.forEach((section, index) => {
    for (const line of section) {
      const m = /^Item Level:\s*(\d+)$/i.exec(line);
      if (m?.[1]) {
        itemLevel = Number(m[1]);
        modifierSectionsStart = index + 1;
      }
    }
  });
  if (itemLevel === null && sections.length > 0) warnings.push('Item level not found');

  const explicitLines: ParsedModifierLine[] = [];
  const otherLines: ParsedOtherLine[] = [];
  let blockCounter = 0;

  for (const section of sections.slice(modifierSectionsStart)) {
    if (isFlagSection(section)) {
      for (const line of section) flagSet.add(line.toLowerCase());
      continue;
    }
    if (isPropertySection(section)) continue;

    let currentHeader: AdvancedModifierHeader | undefined;
    let currentBlock: number | undefined;
    for (const raw of section) {
      const headerMatch = ADVANCED_HEADER.exec(raw);
      if (headerMatch) {
        currentHeader = parseAdvancedHeader(headerMatch[1] ?? '');
        currentBlock = ++blockCounter;
        continue;
      }
      if (/^\(.*\)$/.test(raw)) continue; // reminder text
      if (FLAG_LINES.has(raw.toLowerCase())) {
        flagSet.add(raw.toLowerCase());
        continue;
      }

      const { text, annotations } = stripAnnotations(raw);
      const source = otherSourceOf(annotations, currentHeader);
      if (source) {
        otherLines.push({ source, text });
        continue;
      }
      if (/^Grants Skill:/i.test(text)) continue;
      explicitLines.push({
        text,
        raw,
        fractured: annotations.has('fractured') || currentHeader?.fractured === true,
        ...(currentHeader ? { header: currentHeader, blockId: currentBlock } : {}),
      });
    }
  }

  return {
    itemClass,
    rarity,
    nameLines,
    itemLevel,
    explicitLines,
    otherLines,
    flags: {
      corrupted: flagSet.has('corrupted'),
      fracturedItem: flagSet.has('fractured item'),
      unidentified: flagSet.has('unidentified'),
      mirrored: flagSet.has('mirrored'),
    },
    warnings,
  };
}

function splitSections(input: string): string[][] {
  const sections: string[][] = [];
  let current: string[] = [];
  for (const rawLine of input.replace(/\r\n?/g, '\n').split('\n')) {
    const line = rawLine.trim();
    if (SEPARATOR.test(line)) {
      if (current.length > 0) sections.push(current);
      current = [];
    } else if (line.length > 0) {
      current.push(line);
    }
  }
  if (current.length > 0) sections.push(current);
  return sections;
}

function isFlagSection(section: readonly string[]): boolean {
  return section.every((line) => FLAG_LINES.has(line.toLowerCase()));
}

/** Sections made mostly of "Key: value" lines (properties, requirements, sockets, notes). */
function isPropertySection(section: readonly string[]): boolean {
  if (section.some((line) => ADVANCED_HEADER.test(line))) return false;
  const keyValue = section.filter((line) => KEY_VALUE.test(line)).length;
  return keyValue > 0 && keyValue >= section.length / 2;
}

function stripAnnotations(raw: string): { text: string; annotations: Set<string> } {
  const annotations = new Set<string>();
  let text = raw;
  for (let m = ANNOTATION.exec(text); m; m = ANNOTATION.exec(text)) {
    annotations.add((m[1] ?? '').toLowerCase());
    text = text.slice(0, m.index);
  }
  text = text.replace(ADVANCED_RANGE, '$1').trim();
  return { text, annotations };
}

function otherSourceOf(
  annotations: ReadonlySet<string>,
  header: AdvancedModifierHeader | undefined,
): OtherLineSource | null {
  if (annotations.has('implicit')) return 'implicit';
  if (annotations.has('rune')) return 'rune';
  if (annotations.has('enchant')) return 'enchant';
  return header?.otherSource ?? null;
}

function parseAdvancedHeader(body: string): AdvancedModifierHeader {
  const lower = body.toLowerCase();
  const side: AffixSide | undefined = /\bprefix modifier\b/.test(lower)
    ? 'prefix'
    : /\bsuffix modifier\b/.test(lower)
      ? 'suffix'
      : undefined;
  const name = /"([^"]+)"/.exec(body)?.[1];
  const tier = /\((?:tier|rank):\s*(\d+)\)/i.exec(body)?.[1];
  const otherSource: OtherLineSource | undefined = /\bimplicit modifier\b/.test(lower)
    ? 'implicit'
    : /\brune modifier\b/.test(lower)
      ? 'rune'
      : /\benchant/.test(lower)
        ? 'enchant'
        : undefined;
  return {
    fractured: /\bfractured\b/.test(lower),
    ...(otherSource ? { otherSource } : {}),
    ...(side ? { side } : {}),
    ...(name ? { affixName: name } : {}),
    ...(tier ? { tier: Number(tier) } : {}),
  };
}
