# Golden weight cross-check (2026-10-03)

For each golden base (item level 82) the weights our engine puts into the eligible pool
(`buildEligiblePool` → `CraftDbView.weightFor` → base's weight table) were compared with the
`DropChance` of the same row on the PoE2DB page of that base group (matched by side, required
level and affix name — the same page the golden snapshot reads, captured 2026-10-03, patch 0.5.5).
Spot checks were also made by eye on the live pages (Body_Armours_str: Strength, Fire/Cold/Lightning
Resistance 1000, Chaos Resistance 250, Life 1000).

Cells are `tier: ours / PoE2DB`; `?` = unknown in our data because PoE2DB writes `1` (not measured).
Every family below matches tier for tier; the unknown cells are exactly the rows PoE2DB has not
measured. The regression test is `packages/craft-session/src/golden.test.ts` (totals per side and
the list of unknown modifiers); `pnpm data:golden` regenerates the snapshots from the raw pages.

Craft of Exile (manual look, "Body Armour (STR/INT)") uses the same scale (1000 for common
modifiers, lower values for top tiers); nothing was imported from it.

## Akoyan Spear — Spears

| Family | Side | Text | Tiers (ours / PoE2DB) |
|---|---|---|---|
| Strength | suffix | +# to Strength | T1:250/250 T2:250/250 T3:250/250 T4:250/250 T5:250/250 T6:250/250 T7:250/250 T8:250/250 |
| Dexterity | suffix | +# to Dexterity | T1:750/750 T2:750/750 T3:750/750 T4:750/750 T5:750/750 T6:750/750 T7:750/750 T8:750/750 |
| LocalPhysicalDamagePercent | prefix | #% increased Physical Damage | T1:25/25 T2:50/50 T3:100/100 T4:200/200 T5:400/400 T6:1000/1000 T7:1000/1000 T8:1000/1000 |
| LifeLeechLocalPermyriad | suffix | Leeches #% of Physical Damage as Life | T1:1000/1000 T2:1000/1000 T3:1000/1000 T4:1000/1000 |
| LocalIncreasedAttackSpeed | suffix | #% increased Attack Speed | T1:100/100 T2:200/200 T3:500/500 T4:500/500 T5:1000/1000 T6:1000/1000 T7:1000/1000 T8:1000/1000 |
| LocalCriticalStrikeMultiplier | suffix | +#% to Critical Damage Bonus | T1:125/125 T2:250/250 T3:500/500 T4:1000/1000 T5:1000/1000 T6:1000/1000 |

## Recurve Bow — Bows

| Family | Side | Text | Tiers (ours / PoE2DB) |
|---|---|---|---|
| Dexterity | suffix | +# to Dexterity | T1:1000/1000 T2:1000/1000 T3:1000/1000 T4:1000/1000 T5:1000/1000 T6:1000/1000 T7:1000/1000 T8:1000/1000 |
| LocalPhysicalDamagePercent | prefix | #% increased Physical Damage | T1:25/25 T2:50/50 T3:100/100 T4:200/200 T5:400/400 T6:1000/1000 T7:1000/1000 T8:1000/1000 |
| LifeLeechLocalPermyriad | suffix | Leeches #% of Physical Damage as Life | T1:?/1 T2:1000/1000 T3:1000/1000 T4:1000/1000 |
| LocalIncreasedAttackSpeed | suffix | #% increased Attack Speed | T1:400/400 T2:500/500 T3:1000/1000 T4:1000/1000 T5:1000/1000 |

## Rusted Cuirass — Body_Armours_str

| Family | Side | Text | Tiers (ours / PoE2DB) |
|---|---|---|---|
| Strength | suffix | +# to Strength | T1:1000/1000 T2:1000/1000 T3:1000/1000 T4:1000/1000 T5:1000/1000 T6:1000/1000 T7:1000/1000 T8:1000/1000 |
| FireResistance | suffix | +#% to Fire Resistance | T1:1000/1000 T2:1000/1000 T3:1000/1000 T4:1000/1000 T5:1000/1000 T6:1000/1000 T7:1000/1000 T8:1000/1000 |
| ChaosResistance | suffix | +#% to Chaos Resistance | T1:250/250 T2:250/250 T3:250/250 T4:250/250 T5:250/250 T6:250/250 |
| IncreasedLife | prefix | +# to maximum Life | T1:1000/1000 T2:1000/1000 T3:1000/1000 T4:1000/1000 T5:1000/1000 T6:1000/1000 T7:1000/1000 T8:1000/1000 T9:1000/1000 T10:1000/1000 T11:1000/1000 T12:1000/1000 T13:1000/1000 |
| LocalPhysicalDamageReductionRatingPercent | prefix | #% increased Armour | T1:1000/1000 T2:1000/1000 T3:1000/1000 T4:1000/1000 T5:1000/1000 T6:1000/1000 T7:1000/1000 T8:1000/1000 |

## Rawhide Boots — Boots_dex

| Family | Side | Text | Tiers (ours / PoE2DB) |
|---|---|---|---|
| Dexterity | suffix | +# to Dexterity | T1:1000/1000 T2:1000/1000 T3:1000/1000 T4:1000/1000 T5:1000/1000 T6:1000/1000 T7:1000/1000 T8:1000/1000 |
| ColdResistance | suffix | +#% to Cold Resistance | T1:1000/1000 T2:1000/1000 T3:1000/1000 T4:1000/1000 T5:1000/1000 T6:1000/1000 T7:1000/1000 T8:1000/1000 |
| IncreasedLife | prefix | +# to maximum Life | T1:1000/1000 T2:1000/1000 T3:1000/1000 T4:1000/1000 T5:1000/1000 T6:1000/1000 T7:1000/1000 T8:1000/1000 T9:1000/1000 |
| LocalEvasionRatingIncreasePercent | prefix | #% increased Evasion Rating | T1:1000/1000 T2:1000/1000 T3:1000/1000 T4:1000/1000 T5:1000/1000 T6:1000/1000 T7:1000/1000 |
| MovementVelocity | prefix | 10% increased Movement Speed | T1:1000/1000 T2:1000/1000 T3:1000/1000 T4:1000/1000 T5:1000/1000 T6:1000/1000 |

## Topaz Ring — Rings

| Family | Side | Text | Tiers (ours / PoE2DB) |
|---|---|---|---|
| Intelligence | suffix | +# to Intelligence | T1:1000/1000 T2:1000/1000 T3:1000/1000 T4:1000/1000 T5:1000/1000 T6:1000/1000 T7:1000/1000 T8:1000/1000 |
| LightningResistance | suffix | +#% to Lightning Resistance | T1:1000/1000 T2:1000/1000 T3:1000/1000 T4:1000/1000 T5:1000/1000 T6:1000/1000 T7:1000/1000 T8:1000/1000 |
| AllResistances | suffix | +#% to all Elemental Resistances | T1:800/800 T2:800/800 T3:800/800 T4:800/800 T5:800/800 |
| IncreasedLife | prefix | +# to maximum Life | T1:1000/1000 T2:1000/1000 T3:1000/1000 T4:1000/1000 T5:1000/1000 T6:1000/1000 T7:1000/1000 T8:1000/1000 |
| IncreasedCastSpeed | suffix | #% increased Cast Speed | T1:?/1 T2:?/1 T3:?/1 T4:?/1 T5:?/1 |

## Amber Amulet — Amulets

| Family | Side | Text | Tiers (ours / PoE2DB) |
|---|---|---|---|
| Strength | suffix | +# to Strength | T1:1000/1000 T2:1000/1000 T3:1000/1000 T4:1000/1000 T5:1000/1000 T6:1000/1000 T7:1000/1000 T8:1000/1000 |
| AllResistances | suffix | +#% to all Elemental Resistances | T1:800/800 T2:800/800 T3:800/800 T4:800/800 T5:800/800 T6:800/800 |
| IncreasedLife | prefix | +# to maximum Life | T1:1000/1000 T2:1000/1000 T3:1000/1000 T4:1000/1000 T5:1000/1000 T6:1000/1000 T7:1000/1000 T8:1000/1000 T9:1000/1000 |
| MaximumLifeIncreasePercent | prefix | #% increased maximum Life | T1:300/300 T2:300/300 T3:300/300 |
| CriticalStrikeMultiplier | suffix | #% increased Critical Damage Bonus | T1:125/125 T2:250/250 T3:500/500 T4:1000/1000 T5:1000/1000 T6:1000/1000 |
| IncreasedCastSpeed | suffix | #% increased Cast Speed | T1:?/1 T2:?/1 T3:?/1 T4:?/1 T5:?/1 T6:?/1 |

## Pool totals at item level 82 (from the snapshots)

| Base | Page | Total | Prefixes | Suffixes | Unknown | Fully weighted |
|---|---|---|---|---|---|---|
| Akoyan Spear | Spears | 111305 | 44655 | 66650 | — | yes |
| Recurve Bow | Bows | 97030 | 44755 | 52275 | LifeLeechLocal5, ManaLeechLocal5 | no |
| Rusted Cuirass | Body_Armours_str | 124500 | 54000 | 70500 | — | yes |
| Rawhide Boots | Boots_dex | 113550 | 44000 | 69550 | — | yes |
| Topaz Ring | Rings | 156600 | 69500 | 87100 | CastSpeedJewellery1, CastSpeedJewellery2, CastSpeedJewellery3, CastSpeedJewellery4, CastSpeedJewellery5 | no |
| Amber Amulet | Amulets | 168850 | 72200 | 96650 | CastSpeedJewellery1, CastSpeedJewellery2, CastSpeedJewellery3, CastSpeedJewellery4, CastSpeedJewellery5, CastSpeedJewellery6 | no |
