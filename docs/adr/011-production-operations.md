# ADR 011 — Production data and composable operations

Accepted 2026-10-02.

Production facts are a generated, pinned RePoE export, separate from fixture rules and prices.
The client supplies spawn permissions, not weights. Tiers rank families per base; explicit,
desecrated and special layers are separate. Unknown weights remain null.

`CraftEffect.kind: operations` composes set-rarity, add/remove random mods, reroll-values,
fracture-random-mod and corrupt primitives. Every action is preflighted before sampling, and
failure returns the original item/session without cost or history (including partial Chaos
or multi-add failure). Numeric value rolls and unweighted selection use the supplied seeded RNG.
Fractured modifiers are protected. Unresolved lines block operations that need their identity.
The corrupt primitive sets the flag only; Vaal Orb's outcome distribution is not modelled.

Omens contain action modifiers and scopes. `modifyAction` composes them with a modelled currency;
CraftDB resolves the composed id, and its defaultCost spends both currency and omen. No table of
currency/omen pairs is maintained. Confidence is community until observations verify behaviour.
Production models nine currencies and eight researched omens from pinned client descriptions.
Greater/Perfect currencies stay catalogued: their additional restrictions have not been verified.

History records operation changes and nullable `added` for legacy single-add records; removals,
rerolls and fractures never fabricate an added modifier or an add-mod probability.
The existing analytical probability model covers single-add only; compound actions remain
indeterminate until a dedicated analytical model exists.
