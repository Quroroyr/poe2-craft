# Base selection UX (research, 2026-10-03)

How Craft of Exile (PoE 2) lets a user reach a base, what we take, and what ours does differently.
Observed on the live site (`craftofexile.com/?game=poe2`, patch label "Early-Access 0.5.0") on
2026-10-03. No code, markup or styles were copied.

## Craft of Exile

- **Step 1 — Base group** (required): one row of 13 buttons — Body Armours, Boots, Charms, Flasks,
  Gloves, Helmets, Jewellery, Jewels, Offhands, One-Handed Weapons, Tablets, Two-Handed Weapons,
  Waystones.
- **Step 2 — Base**: the kinds inside the group. Defence slots split by attribute:
  `Body Armour (STR)`, `(DEX)`, `(INT)`, `(STR/DEX)`, `(STR/INT)`, `(DEX/INT)`, plus special bases
  such as `Grasping Mail`. Jewellery → Amulet / Belt / Ring. One-Handed Weapons → Claw, Dagger,
  Flail, One Hand Axe/Mace/Sword, Sceptre, Spear, Wand, and element-specific wands. Offhands →
  Focus, Quiver, Shield (STR), (DEX), (STR/DEX), (STR/INT).
- **Step 3 — Item** (optional, defaults to "None"): the concrete base. The mod pool and weights
  are already shown after step 2, because they belong to the kind, not to the exact base.
- A free-text "Search for a base or item" field sits next to the steps; the chosen path stays
  visible as a label row ("Base group: Body Armours · Base: Body Armour (STR/INT)").

## What we take

- Two or three decisions instead of one huge list: type → kind → base.
- Defence slots split by attribute combination; weapons split by class; jewellery by slot.
- A special-bases bucket for bases whose defences do not fit one attribute type.
- A whole-catalog search as a shortcut for users who know the name.

## What we do differently

- **The concrete base is required.** Our item state needs a base (implicits, item-level rules,
  art, weight table), so step 3 is a choice, not an optional refinement.
- **Hierarchy from data, not a hand list.** Categories come from the class category and base
  tags; the attribute kind from defence properties checked against the attribute spawn tag
  (`defenceArchetype`). Classes with one kind skip step 2.
- **Step 1 is grouped** into Armour / Jewellery / Weapons / Off-hand sections with tiles that
  show a picture, the number of bases and the level range, instead of a flat button row.
- **Only obtainable bases.** Developer records (`[DNT] …`), records that exist only to carry a
  unique item, and bases the official trade does not list are hidden (they stay in the dataset
  and the clipboard importer still recognises them).
- **Breadcrumb, Back and Escape** walk back one level; each level keeps its scroll position;
  the search shows where each result sits ("Rings", "Body Armours · STR/INT").
- Element-specific wands/staves are not separate groups: their difference is visible on the base
  row (implicit, level), and the pool follows the base's tags automatically.
