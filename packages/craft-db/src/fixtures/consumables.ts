/**
 * Consumables of the fixture dataset: real PoE 2 names and icon art from GGG's trade data
 * (`trade2/data/static`, checked 2026-10-02). Being listed here does NOT mean a mechanic is
 * modelled: only consumables spent by an action in `akoyan-spear.ts` do anything when clicked;
 * the palette marks every other one as not modelled (ADR 008).
 *
 * Omen scopes ("which currency an omen changes") are general knowledge, not verified against game
 * data, and only drive the compatible / incompatible label of the palette.
 */
import type { Consumable, ConsumableCategory, Provenance } from '@poe2-craft/craft-domain';
import { ALWAYS, GENERAL_KNOWLEDGE_SOURCE_ID, OFFICIAL_TRADE_DATA_SOURCE_ID } from './sources';

/** Names (and art ids) confirmed against GGG's PoE 2 trade data endpoints. */
const OFFICIAL_NAME: Provenance = {
  sourceId: OFFICIAL_TRADE_DATA_SOURCE_ID,
  confidence: 'official',
  lastVerified: '2026-10-02',
  notes: 'Name and icon art taken from pathofexile.com/api/trade2/data/static; mechanics not covered by this source',
};

const OMEN_SCOPE: Provenance = {
  sourceId: GENERAL_KNOWLEDGE_SOURCE_ID,
  confidence: 'experimental',
  notes: 'Which currency the omen applies to, from the omen description as commonly known; not verified',
};

function consumable(
  id: string,
  name: string,
  category: ConsumableCategory,
  art: string,
  modifies?: readonly string[],
): Consumable {
  return {
    id,
    name,
    category,
    art,
    ...(modifies ? { modifies: { consumableIds: modifies, provenance: OMEN_SCOPE } } : {}),
    versions: ALWAYS,
    provenance: OFFICIAL_NAME,
  };
}

export const consumables: Consumable[] = [
  consumable('currency.orb-of-transmutation', 'Orb of Transmutation', 'currency', 'Art/2DItems/Currency/CurrencyUpgradeToMagic'),
  consumable('currency.orb-of-augmentation', 'Orb of Augmentation', 'currency', 'Art/2DItems/Currency/CurrencyAddModToMagic'),
  consumable('currency.orb-of-alchemy', 'Orb of Alchemy', 'currency', 'Art/2DItems/Currency/CurrencyUpgradeToRare'),
  consumable('currency.orb-of-chance', 'Orb of Chance', 'currency', 'Art/2DItems/Currency/CurrencyUpgradeToUnique'),
  consumable('currency.regal-orb', 'Regal Orb', 'currency', 'Art/2DItems/Currency/CurrencyUpgradeMagicToRare'),
  consumable('currency.exalted-orb', 'Exalted Orb', 'currency', 'Art/2DItems/Currency/CurrencyAddModToRare'),
  consumable('currency.perfect-exalted-orb', 'Perfect Exalted Orb', 'currency', 'Art/2DItems/Currency/CurrencyAddModToRare'),
  consumable('currency.chaos-orb', 'Chaos Orb', 'currency', 'Art/2DItems/Currency/CurrencyRerollRare'),
  consumable('currency.perfect-chaos-orb', 'Perfect Chaos Orb', 'currency', 'Art/2DItems/Currency/CurrencyRerollRare'),
  consumable('currency.divine-orb', 'Divine Orb', 'currency', 'Art/2DItems/Currency/CurrencyModValues'),
  consumable('currency.orb-of-annulment', 'Orb of Annulment', 'currency', 'Art/2DItems/Currency/AnnullOrb'),
  consumable('currency.vaal-orb', 'Vaal Orb', 'currency', 'Art/2DItems/Currency/CurrencyVaal'),
  consumable('currency.fracturing-orb', 'Fracturing Orb', 'currency', 'Art/2DItems/Currency/FracturingOrb'),
  consumable('currency.artificers-orb', 'Artificer\'s Orb', 'currency', 'Art/2DItems/Currency/CurrencyAddEquipmentSocket'),
  consumable('currency.mirror-of-kalandra', 'Mirror of Kalandra', 'currency', 'Art/2DItems/Currency/CurrencyDuplicate'),
  consumable('omen.dextral-exaltation', 'Omen of Dextral Exaltation', 'omen', 'Art/2DItems/Currency/Omens/VoodooOmens3Yellow', ['currency.exalted-orb', 'currency.perfect-exalted-orb']),
  consumable('omen.sinistral-exaltation', 'Omen of Sinistral Exaltation', 'omen', 'Art/2DItems/Currency/Omens/VoodooOmens2Yellow', ['currency.exalted-orb', 'currency.perfect-exalted-orb']),
  consumable('omen.greater-exaltation', 'Omen of Greater Exaltation', 'omen', 'Art/2DItems/Currency/Omens/VoodooOmens1Yellow', ['currency.exalted-orb', 'currency.perfect-exalted-orb']),
  consumable('omen.homogenising-exaltation', 'Omen of Homogenising Exaltation', 'omen', 'Art/2DItems/Currency/Omens/OmenOnExaltAddExistingModType', ['currency.exalted-orb', 'currency.perfect-exalted-orb']),
  consumable('omen.catalysing-exaltation', 'Omen of Catalysing Exaltation', 'omen', 'Art/2DItems/Currency/Omens/OmenOnExaltConsumeQuality', ['currency.exalted-orb', 'currency.perfect-exalted-orb']),
  consumable('omen.whittling', 'Omen of Whittling', 'omen', 'Art/2DItems/Currency/Omens/VoodooOmens1Dark', ['currency.chaos-orb', 'currency.perfect-chaos-orb']),
  consumable('omen.dextral-erasure', 'Omen of Dextral Erasure', 'omen', 'Art/2DItems/Currency/Omens/VoodooOmens3Dark', ['currency.chaos-orb', 'currency.perfect-chaos-orb']),
  consumable('omen.sinistral-erasure', 'Omen of Sinistral Erasure', 'omen', 'Art/2DItems/Currency/Omens/VoodooOmens2Dark', ['currency.chaos-orb', 'currency.perfect-chaos-orb']),
  consumable('omen.dextral-annulment', 'Omen of Dextral Annulment', 'omen', 'Art/2DItems/Currency/Omens/VoodooOmens3Purple', ['currency.orb-of-annulment']),
  consumable('omen.sinistral-annulment', 'Omen of Sinistral Annulment', 'omen', 'Art/2DItems/Currency/Omens/VoodooOmens2Purple', ['currency.orb-of-annulment']),
  consumable('omen.homogenising-coronation', 'Omen of Homogenising Coronation', 'omen', 'Art/2DItems/Currency/Omens/OmenOnRegalAddExistingModType', ['currency.regal-orb']),
  consumable('omen.corruption', 'Omen of Corruption', 'omen', 'Art/2DItems/Currency/Omens/VoodooOmens3Red', ['currency.vaal-orb']),
  consumable('essence.essence-of-flames', 'Essence of Flames', 'essence', 'Art/2DItems/Currency/Essence/FireEssence'),
  consumable('essence.essence-of-ice', 'Essence of Ice', 'essence', 'Art/2DItems/Currency/Essence/ColdEssence'),
  consumable('essence.essence-of-electricity', 'Essence of Electricity', 'essence', 'Art/2DItems/Currency/Essence/LightningEssence'),
  consumable('essence.essence-of-abrasion', 'Essence of Abrasion', 'essence', 'Art/2DItems/Currency/Essence/PhysicalEssence'),
  consumable('essence.essence-of-haste', 'Essence of Haste', 'essence', 'Art/2DItems/Currency/Essence/SpeedEssence'),
  consumable('essence.essence-of-seeking', 'Essence of Seeking', 'essence', 'Art/2DItems/Currency/Essence/CriticalEssence'),
  consumable('essence.essence-of-battle', 'Essence of Battle', 'essence', 'Art/2DItems/Currency/Essence/AttackEssence'),
  consumable('essence.essence-of-the-body', 'Essence of the Body', 'essence', 'Art/2DItems/Currency/Essence/LifeEssence'),
  consumable('catalyst.flesh-catalyst', 'Flesh Catalyst', 'catalyst', 'Art/2DItems/Currency/Breach/BreachCatalystLife'),
  consumable('catalyst.neural-catalyst', 'Neural Catalyst', 'catalyst', 'Art/2DItems/Currency/Breach/BreachCatalystMana'),
  consumable('catalyst.carapace-catalyst', 'Carapace Catalyst', 'catalyst', 'Art/2DItems/Currency/Breach/BreachCatalystDefences'),
  consumable('catalyst.reaver-catalyst', 'Reaver Catalyst', 'catalyst', 'Art/2DItems/Currency/Breach/BreachCatalystAttack'),
  consumable('catalyst.sibilant-catalyst', 'Sibilant Catalyst', 'catalyst', 'Art/2DItems/Currency/Breach/BreachCatalystCaster'),
  consumable('catalyst.skittering-catalyst', 'Skittering Catalyst', 'catalyst', 'Art/2DItems/Currency/Breach/BreachCatalystSpeed'),
  consumable('catalyst.adaptive-catalyst', 'Adaptive Catalyst', 'catalyst', 'Art/2DItems/Currency/Breach/BreachCatalystAttribute'),
  consumable('rune.desert-rune', 'Desert Rune', 'rune', 'Art/2DItems/Currency/Runes/FireRune'),
  consumable('rune.glacial-rune', 'Glacial Rune', 'rune', 'Art/2DItems/Currency/Runes/ColdRune'),
  consumable('rune.storm-rune', 'Storm Rune', 'rune', 'Art/2DItems/Currency/Runes/LightningRune'),
  consumable('rune.iron-rune', 'Iron Rune', 'rune', 'Art/2DItems/Currency/Runes/EnhanceRune'),
  consumable('rune.body-rune', 'Body Rune', 'rune', 'Art/2DItems/Currency/Runes/LifeRune'),
  consumable('rune.mind-rune', 'Mind Rune', 'rune', 'Art/2DItems/Currency/Runes/ManaRune'),
  consumable('rune.vision-rune', 'Vision Rune', 'rune', 'Art/2DItems/Currency/Runes/AccuracyRune'),
];
