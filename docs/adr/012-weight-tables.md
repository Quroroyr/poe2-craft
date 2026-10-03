# ADR 012 — Community weight tables per group of bases

Accepted 2026-10-03.

## Context

The client export has no spawn weights (ADR 011): random additions were refused on production data.
PoE2DB publishes community weights (Krakenbul's recombinator data) per item class page or per
attribute page (`Body_Armours_str`). Rows have no modifier id. Values differ between pages, and a
page may mark a modifier "not measured" that another page measured.

## Decision

- **Weight table = one PoE2DB page = one group of bases.** `CraftDataset.weightTables` holds
  `WeightTable { id, itemClassId, requiredTags, entries[{modifierId, weight, rawValue}], unmeasured,
  evidence }`. Evidence is shared by the table: source `poe2db-weightings`, method
  `recombinator-observation`, confidence `community`, capture date, patch, page.
- **A base names its table** (`ItemBase.weightTableId`) and reads weights from it only. A modifier
  absent from the table or listed as unmeasured has `weight: null` on that base. Values are never
  borrowed from another table, tier, family or class, and never filled with 0, 1 or an average.
- **One lookup.** `resolveModifierWeight` (craft-domain) / `CraftDbView.weightFor` is the only
  place a weight is read; `buildEligiblePool` copies it into each `PoolEntry`. Probability preview,
  pool explorer and the sampler (`pickWeighted`) all read those entries, so preview and execution
  cannot use different numbers. Spawn permission stays a separate fact (`spawnWeights[].spawns`).
- **Partial pools give no number.** If any eligible modifier of the action's pool has an unknown
  weight, the probability is `indeterminate: partial-weights` and random additions are refused.
  The former "upper bound" result is removed.
- Hand-written data (fixture) keeps weights on `spawnWeights` and needs no table.
- The weights file carries the game version and PoE2DB patch; building the production dataset with
  a weights file of another version throws.

## Consequences

- Real-data Exalted / Transmutation / Augmentation / Regal / Alchemy / Chaos work wherever the
  current pool is fully weighted (1 180 of 1 559 craftable bases have fully weighted pools).
- Classes PoE2DB has not measured stay blocked; adding a new source means a new table with its own
  evidence, not editing numbers.
- Matching rows to modifiers is a data-pipeline concern (`scripts/data/weights-normalize.ts`), with
  unresolved and conflicting rows reported instead of guessed.
