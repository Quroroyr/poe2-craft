/**
 * FIXTURE item texts, hand-constructed in the layout of PoE 2 Ctrl+C copies.
 * Property numbers (damage, requirements) are placeholders and not real Akoyan Spear stats;
 * modifier lines are chosen to resolve against the Akoyan Spear fixture CraftDB.
 */

export interface SampleItem {
  readonly id: string;
  readonly label: string;
  readonly text: string;
}

const PROPERTIES = `--------
Spear
Physical Damage: 40-75 (augmented)
Critical Hit Chance: 9.12% (augmented)
Attacks per Second: 1.60
--------
Requires: Level 78, 65 Str, 160 Dex
--------`;

export const AKOYAN_SPEAR_FRACTURED_CRIT = `Item Class: Spears
Rarity: Rare
Grim Skewer
Akoyan Spear
${PROPERTIES}
Item Level: 82
--------
+4.12% to Critical Hit Chance (fractured)
--------
Fractured Item`;

export const AKOYAN_SPEAR_FOUR_MODS = `Item Class: Spears
Rarity: Rare
Doom Lance
Akoyan Spear
${PROPERTIES}
Item Level: 82
--------
98% increased Physical Damage
Adds 18 to 30 Physical Damage
+4.12% to Critical Hit Chance (fractured)
12% increased Attack Speed
--------
Fractured Item`;

export const AKOYAN_SPEAR_UNKNOWN_LINE = `Item Class: Spears
Rarity: Rare
Storm Needle
Akoyan Spear
${PROPERTIES}
Item Level: 82
--------
+4.12% to Critical Hit Chance (fractured)
+1 to Maximum Fixture Charges
--------
Fractured Item`;

export const AKOYAN_SPEAR_ILVL_70 = `Item Class: Spears
Rarity: Rare
Grim Skewer
Akoyan Spear
${PROPERTIES}
Item Level: 70
--------
+2.80% to Critical Hit Chance (fractured)
--------
Fractured Item`;

export const AKOYAN_SPEAR_ADVANCED = `Item Class: Spears
Rarity: Rare
Grim Skewer
Akoyan Spear
${PROPERTIES}
Item Level: 82
--------
{ Prefix Modifier "Wicked" (Tier: 2) — Damage, Physical, Attack }
72(65-84)% increased Physical Damage
{ Fractured Suffix Modifier "of Puncturing" (Tier: 1) — Attack, Critical }
+4.12(3.21-4.4)% to Critical Hit Chance (fractured)
--------
Fractured Item`;

export const SAMPLE_ITEMS: readonly SampleItem[] = [
  { id: 'fractured-crit', label: 'Akoyan Spear · ilvl 82 · fractured crit', text: AKOYAN_SPEAR_FRACTURED_CRIT },
  { id: 'four-mods', label: 'Akoyan Spear · 4 mods', text: AKOYAN_SPEAR_FOUR_MODS },
  { id: 'unknown-line', label: 'Akoyan Spear · unknown line', text: AKOYAN_SPEAR_UNKNOWN_LINE },
  { id: 'ilvl-70', label: 'Akoyan Spear · ilvl 70', text: AKOYAN_SPEAR_ILVL_70 },
  { id: 'advanced', label: 'Akoyan Spear · Ctrl+Alt+C', text: AKOYAN_SPEAR_ADVANCED },
];
