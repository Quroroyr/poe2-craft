# Craft of Exile (PoE 2) — behaviour notes (research, 2026-10-02)

Craft of Exile is the reference crafting calculator for Path of Exile. These notes describe its
**public behaviour and documentation** (how-to-use page, weightings page, visible workflow) to decide
what our planner needs. No source code, data files or UI were copied.

| Idea | What they do | Why it is useful | Do we need it | How ours differs |
|---|---|---|---|---|
| Calculator / Simulator / Emulator as three modules | Calculator computes chances for a method; Simulator runs mass simulations with "triggers and condition checks"; Emulator applies currencies to an item | separates "what are the odds" from "let me try" from "will my plan work" | yes, but as one workspace | we already merge emulator (click currency on the current item) and calculator (pool, chance, expected cost) on one screen; mass simulation waits for the solver stage |
| Mod pool by family with tiers | left-click an affix to see its tiers and choose success conditions | the pool is the main object of crafting decisions | yes — exists (v0.5.1 picker) | tiers computed per base from client data; unknown weights are shown as unknown, not as numbers |
| Right-click to lock a mod as "already present" | marks existing mods for Exalt / Regal methods | fast item setup | yes — exists (v0.6 context menu, source setup) | setup vs manual edit vs craft are separate session concepts (ADR 007, 009) |
| Target groups (G1 / G2 / G3) | several affixes count as alternatives for one condition | "any of these" targets are common | later (target OR-groups) | `TargetSpec` requirements are "family at tier N or better"; OR-groups are a planned extension |
| Weightings page with method and caveats | publishes estimated weights, explains recombinator / trade methods and biases | honesty about data quality | yes — as provenance | we keep weights `null` unless a permitted source exists; any community weight carries method, date, confidence |
| Pricing | prices of currencies from the market feed a cost estimate | cost is what players optimise | yes | prices are a separate layer (league + timestamp), never part of action definitions; manual override kept |
| Mod groupings / blocked mods | visual marks for present, required, blocked, grouped mods | understanding collisions | yes — exists (status: eligible / already present / blocked / excluded with reasons) | every exclusion has a structured reason in the engine |
| Save / share state | state kept per user | resume work | later | out of scope now |

## Things we deliberately do differently

- **No invented numbers.** Where Craft of Exile shows an estimated weight, we show "unknown weight"
  unless the value has a permitted, recorded source.
- **One generic rule engine** for applicability (tags, ilvl, groups, slots, action restrictions);
  bases have no special code.
- **Modelled vs catalogued** is explicit: every consumable is listed, only modelled ones apply.
- **Manual edits are not crafting** (ADR 009); the history shows them apart and spending ignores them.
