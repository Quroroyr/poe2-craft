# Real data landscape for PoE 2 (research, 2026-10-02)

What exists publicly for Path of Exile 2 crafting data, what each source is good for, and what we
take from it. Rule of thumb: **game-client facts come from an export of the client; everything else
is cross-check or explicitly labelled community data**.

## Sources inspected

| Source | What it is | Access | What we use it for |
|---|---|---|---|
| **RePoE — PoE 2 export** (`github.com/repoe-fork/poe2`, site `repoe-fork.github.io/poe2`) | JSON export of the game client `.dat` tables made with PyPoE (`github.com/repoe-fork/pypoe`, GPL-3.0) and RePoE (`github.com/repoe-fork/repoe`, MIT) | static files; every export is a git commit (`version.txt` = client version) | **primary production source**: item classes, base items, modifiers, tags, augments (runes / soul cores), base art (PNG) |
| **Official trade2 reference API** (`pathofexile.com/api/trade2/data/static`, `/items`, `/stats`) | GGG's public reference data for the trade site | JSON, rate-limited, not versioned | consumable catalogue grouping (Currency / Runes / Essences / Omens / Breach / Delirium / Abyss / Vaal), base type list (cross-check of which bases are real and tradeable), trade stat texts |
| **Official trade2 search / fetch** | listing JSON | rate-limited | used in v0.4 for base properties of 13 bases; superseded by RePoE `properties` |
| **PoE2DB** (`poe2db.tw`) | human-readable database built from the same client files | HTML; wiki text under CC BY-NC-SA 3.0; `robots.txt` allows crawling | **cross-check only**: modifier / tier / ilvl lookups, tag investigation, manual validation of golden cases. Not a runtime or ingestion dependency |
| **Craft of Exile — PoE 2** (`craftofexile.com/?game=poe2`) | crafting calculator / simulator / emulator | website; no data-reuse terms | **product behaviour reference** and manual comparison of weights; no data is imported (see `craft-of-exile.md`) |
| **poe.ninja economy API** (`poe.ninja/docs/api`) | documented public economy endpoints for PoE 1 and PoE 2 | `GET /poe2/api/economy/leagues`, `GET /poe2/api/economy/exchange/current/overview?league=&type=` | **market prices** (separate layer). The builds / profiles API is internal and is not used |
| PoE 2 Wiki (`poe2wiki.net`) | community wiki, also generated from PyPoE | MediaWiki, CC BY-NC-SA | mechanics descriptions for researching currencies, cross-check |

Open-source code used as a reference: none copied. RePoE / PyPoE are used only through their
published data output (MIT tooling; the data itself is GGG's).

## What the client export gives (extracted facts)

From `mods.json` (16 784 records, client 4.5.5.2):

- stable id (the `.dat` row id, e.g. `IncreasedMana7`), `type` (= modifier **family**), `groups`
  (collision groups), `domain` (item, flask, desecrated, monster, area…), `generation_type` (prefix,
  suffix, unique — implicits and unique mods, corrupted — Vaal enchants, essence — monster-only here…),
  `required_level`, affix `name`, `stats` (stat ids with min / max), display `text`, `implicit_tags`
  (descriptive tags), `adds_tags`;
- `spawn_weights` — but **only 0 or 1**. They say *whether* a modifier can appear on a base with a
  tag (the first matching tag decides), not *how likely* it is. `generation_weights` are empty.

From `base_items.json` (5 496 records): class, name, drop level, requirements, properties (damage,
crit, attack time, armour…), implicit mod ids, tags (the ones spawn weights match), art (`.dds` path,
PNG available on the RePoE site), release state.

From `item_classes.json` (118 classes): id, display name (= `Item Class:` line of Ctrl+C), category.

From `augments.json` (313): runes, soul cores, talismans — effect text per item category.

From `mods_by_base.json`: RePoE's own grouping of which mods spawn on which base tag sets — an
independent computation we use to **cross-check our applicability engine**.

### Tiers are not a stored number

A tier is the rank of a modifier inside its family **among the modifiers that can spawn on a given
base**, ordered by required level. The same mod can be T1 on gloves and T4 on a ring (e.g.
`IncreasedMana9`: rings also have `IncreasedMana10–12`), and two-handed staves have their own series
of the same family. So the tier must be computed per base, never stored as one global number.

## What is NOT available directly

| Data | Status | Consequence |
|---|---|---|
| **Modifier spawn weights** | not in the client. Craft of Exile: "information regarding modifier weightings is not part of the game client", estimated with recombinators (Prohibited Library) and trade listings, then normalised. PoE2DB: "Modifier weight information cannot be obtained from game files." | production weights are `null` (unknown) with explicit evidence; probabilities that need them are **indeterminate**, and random-outcome actions refuse to run (invariant 8, 27) |
| Essence → modifier table | not in this export (only monster essence mods) | essences are catalogued, not modelled |
| Omen effects, currency rules | not data; described in patch notes, item descriptions and the wiki | modelled by hand as rules with `community` confidence and a source note |
| Catalyst / quality-for-tag effects | partly in base item descriptions | catalogued |
| Translated (RU) game names | not in this export | game names stay English; the interface is EN / RU |

## Community / observed data

Craft of Exile publishes recombinator- and trade-derived weights on its site, without terms that
allow reuse. They are **not imported**. If a source with clear permission appears, it enters as a
`WeightEvidence` with `method: recombinator-observation | trade-observation | community-estimate`,
never as game data.

## Version mapping

RePoE `version.txt` = client version `4.5.5.2`. PoE 2 early-access client versions map as
`4.<minor>.<patch>.<hotfix>` ↔ game `0.<minor>.<patch>`; this export is recorded as game version
`0.5.5` (client 4.5.5.2). The mapping is an assumption written into the dataset provenance.

## Decisions

1. Production data = RePoE export, pinned by commit; raw snapshot + manifest (`data/raw/manifest.json`).
2. Official trade2 data = second source for consumable categories and the list of real base types.
3. PoE2DB and Craft of Exile = manual cross-check and behaviour reference, not ingested.
4. Weights unknown until a permitted measured source exists; the model keeps room for evidence.
5. Prices from poe.ninja's documented economy endpoints, server-side, cached, per league.
