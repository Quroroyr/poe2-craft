# PoE2DB weightings (research, 2026-10-03)

Where PoE2DB keeps modifier weights for PoE 2, how they are represented, and how we import them.
Checked against the live site on 2026-10-03; PoE2DB showed patch **0.5.5** as running ("Running
for" link on the home page; latest hotfix 0.5.5d), the same patch as our client export 4.5.5.2.

## Where the weights are

- [poe2db.tw/us/weightings](https://poe2db.tw/us/weightings) explains the origin: *"Weight
  information cannot be obtained from game file. Following weight information compiled by
  Krakenbul, the author of Prohibited Library Discord Mods Weight SpreadSheets using recombinators."*
  Bases that cannot be recombined (charms, jewels, tablets, waystones) are estimated from trade
  listings; desecrated modifiers per class are queried from trade.
- The numbers are shown on **item class pages**: `Rings`, `Spears`, `Bows`… For classes split by
  defence type there is one page per attribute option: `Body_Armours_str`, `Body_Armours_str_int`,
  `Helmets_dex`, `Shields_str_dex`… The class page itself (`Body_Armours`) lists bases only.
- Every such page embeds its modifier table as JSON: the argument of `new ModsView({...})` in an
  inline script. No separate machine-readable endpoint or download was found; the per-modifier
  hover endpoint on `cdn.poe2db.tw` answers 403 to non-browser requests.

## Representation

`ModsView` object (fields we use):

| Field | Meaning |
|---|---|
| `baseitem.opts` | attribute options of the class (`str`, `dex`, `int`, `str_dex`, `str_int`, `dex_int`, `str_dex_int`) |
| `opt.tags` | spawn tag(s) the page is built for, e.g. `str_armour`, `str_armour,str_shield`; absent on single-page classes |
| `normal[]` | ordinary prefixes/suffixes: one row **per tier** |
| `normal[].Name`, `.Level`, `.ModGenerationTypeID` | affix name, required level, 1 = prefix / 2 = suffix |
| `normal[].ModFamilyList` | collision groups (our `groupIds`) |
| `normal[].spawn_no` | the modifier's spawn tags (the same list as the client export) |
| `normal[].str` | display HTML; rolled values in `<span class='mod-value'>` |
| `normal[].DropChance` | **the weight**, a string such as `"1000"`, `"500"`, `"250"` |
| `desecrated[]`, `essence[]`, `corrupted[]`, `socketable[]`… | other layers; `DropChance` there is `0` or `1` (no weights) |

Rows carry **no modifier id**. Weights are per tier (`Strength1` … `Strength8` each have their own
row); in the data seen so far tiers of one family usually share a value, but not always, so we
never copy a value from one tier to another.

### "No data" markers

`DropChance` of `1` (or `0`) means *not measured*:

- whole pages: Daggers, Flails, One/Two Hand Swords and Axes, Body_Armours_str_dex_int (all `1`);
  Life/Mana Flasks and Charms (all `0`);
- single families on otherwise weighted pages: Cast Speed on rings and amulets, Energy Shield
  Recharge on INT body armours, the level-65 Leech tiers on bows and crossbows, Surpassing Arrow on
  quivers.

The smallest real weight seen is 25. Values ≤ 1 are imported as **unknown**, never as a weight.

### Groups

The same modifier can have different values on different pages, and a page can say "not measured"
for a modifier that another page measured (level-65 life leech: 1000 on maces, `1` on bows). So a
weight is a property of **(modifier, page)**: one page = one group of bases = one weight table.
A base belongs to the page of its class whose `opt.tags` it carries (the most specific one).

## Stability and limits

- Pages are server-rendered HTML; the embedded JSON shape (`ModsView`) is not a documented API and
  can change without notice. The parser fails loudly when the object is missing.
- No per-page revision; we record URL, fetch time, sha256 of the HTML and the patch shown on the
  home page (`data/raw/poe2db/manifest.json`).
- `robots.txt` allows all agents (`Allow: /`). Our fetcher sends one request every 2.5 s, caches
  pages and only re-downloads with `--refresh`. The application never contacts PoE2DB.
- Licence: PoE2DB wiki content CC BY-NC-SA 3.0; game content © GGG. This is a non-commercial fan
  tool; the source and author are credited in the data and the UI.
- Methodology (recombinators) gives relative weights for the measured groups; it is community data
  (`confidence: community`, `method: recombinator-observation`), not extracted from the client.

## Cross-check with Craft of Exile

Craft of Exile shows weights per base archetype ("Body Armour (STR/INT)") with the same scale
(1000 / 500 / 250 …) and credits recombinator-based estimation on its Weightings page. It is used
only as a manual reference; nothing is imported from it.

## How we import

1. `pnpm data:weights:fetch` — class pages, attribute pages discovered from `baseitem.opts`;
   only the `ModsView` JSON is stored (`data/raw/poe2db/<page>.json`, not committed).
2. `pnpm data:weights:normalize` — every row is matched to a modifier of our dataset by side +
   level + affix name, then (only if several remain) rolled numbers, spawn tags, collision groups.
   Text is never the key. No candidate / several candidates → `unresolved`, never guessed.
   Output: `packages/craft-db/src/production/poe2db-weights.json` (tables, base assignment,
   unmeasured, unresolved, conflicts).
3. `pnpm data:weights:validate` — pipeline unit tests, dataset validation, golden weights.
4. `pnpm data:weights:report` — coverage per group in `data/coverage-report.json`.

Result on 2026-10-03: 53 tables, 7 760 rows, 7 755 matched, 6 434 weights, 1 321 unmeasured,
5 unresolved (mana flask "of Life Recovery to Minions" rows: no such modifier in our export),
0 conflicts. 1 819 bases have a table; 14 bases of split classes have no fitting page
(STR/DEX/INT boots, gloves, helmets; unique-only "Golden" bases).
