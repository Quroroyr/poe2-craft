# Golden cases — pinned client 4.5.5.2

Snapshots derive from RePoE `mods_by_base.json`, independently of our spawn engine.
All cases use rare ilvl 82: Akoyan Spear (162 explicit mods), Recurve Bow (140),
Rusted Cuirass (144), Rawhide Boots (129), Topaz Ring (203), Amber Amulet (209).
Tests compare complete eligible ids, families, levels, per-base tiers, groups, unknown weights,
properties and implicits; adding a fractured group occupant must exclude every colliding tier.
`pnpm data:golden` deliberately updates snapshots; it is not part of automatic refresh.

Manual cross-check 2026-10-02, no PoE2DB data ingestion:

| Case | Public page | Checked |
|---|---|---|
| Akoyan Spear | https://poe2db.tw/us/Akoyan_Spear | FourSpear10Endgame, drop level 78, spear/onehand tags, hidden DisplaySpearThrow implicit |
| Recurve Bow | https://poe2db.tw/us/Recurve_Bow | FourBow4, drop level 16, bow/ranged/twohand tags |
| Rusted Cuirass | https://poe2db.tw/us/Rusted_Cuirass | FourBodyStr1, drop level 1, str_armour/body_armour tags |
| Rawhide Boots | https://poe2db.tw/us/Rawhide_Boots | FourBootsDex1, drop level 1, dex_armour/boots tags |
| Topaz Ring | https://poe2db.tw/us/Topaz_Ring | FourRing5, drop level 16, LightningResistance implicit 20–30 |
| Amber Amulet | https://poe2db.tw/us/Amber_Amulet | FourAmulet3, drop level 8, Strength implicit 10–15 |

These live pages are not pinned to the client's revision. Their generic Base.* debug fields
are not used as the source for weapon damage/armour: those properties come from the pinned export.
The full modifier/tier sets were checked automatically against RePoE, not manually line by line
against PoE2DB; no claim of independent in-game validation is made.
