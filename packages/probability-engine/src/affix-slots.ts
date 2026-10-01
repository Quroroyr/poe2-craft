import type {
  AffixLimitRule,
  AffixSide,
  ItemState,
  ModifierGroupId,
  ModifierId,
} from '@poe2-craft/craft-domain';
import type { CraftDbView } from '@poe2-craft/craft-db';

export interface SideSlots {
  readonly side: AffixSide;
  readonly max: number;
  readonly used: number;
  readonly free: number;
}

export interface SlotSummary {
  readonly prefix: SideSlots;
  readonly suffix: SideSlots;
  /** Explicit lines whose side we could not determine; they occupy a slot somewhere. */
  readonly unknownSide: number;
}

/** Who occupies a modifier group on the item. */
export interface GroupOccupant {
  readonly groupId: ModifierGroupId;
  readonly modifierId: ModifierId | null;
  readonly sourceText: string;
  readonly fractured: boolean;
  /** True when the occupant is an unresolved line whose group was inferred from text. */
  readonly inferred: boolean;
}

export interface ItemAffixFacts {
  readonly slots: SlotSummary;
  readonly occupiedGroups: readonly GroupOccupant[];
  readonly presentModifierIds: ReadonlySet<ModifierId>;
  /** Ids on the item that do not exist in the selected game version. */
  readonly missingModifierIds: readonly ModifierId[];
}

export function collectAffixFacts(
  item: ItemState,
  view: CraftDbView,
  limits: AffixLimitRule,
): ItemAffixFacts {
  const used: Record<AffixSide, number> = { prefix: 0, suffix: 0 };
  let unknownSide = 0;
  const occupiedGroups: GroupOccupant[] = [];
  const presentModifierIds = new Set<ModifierId>();
  const missingModifierIds: ModifierId[] = [];

  for (const mod of item.explicits) {
    if (mod.kind === 'resolved') {
      presentModifierIds.add(mod.modifierId);
      const definition = view.getModifier(mod.modifierId);
      if (!definition) {
        missingModifierIds.push(mod.modifierId);
        unknownSide++;
        continue;
      }
      used[definition.side]++;
      for (const groupId of definition.groupIds) {
        occupiedGroups.push({
          groupId,
          modifierId: mod.modifierId,
          sourceText: mod.sourceText,
          fractured: mod.fractured,
          inferred: false,
        });
      }
    } else {
      if (mod.sideHint) used[mod.sideHint]++;
      else unknownSide++;
      for (const groupId of mod.groupIdsHint ?? []) {
        occupiedGroups.push({
          groupId,
          modifierId: null,
          sourceText: mod.sourceText,
          fractured: mod.fractured,
          inferred: true,
        });
      }
    }
  }

  const side = (s: AffixSide, max: number): SideSlots => ({
    side: s,
    max,
    used: used[s],
    free: Math.max(0, max - used[s]),
  });

  return {
    slots: {
      prefix: side('prefix', limits.maxPrefixes),
      suffix: side('suffix', limits.maxSuffixes),
      unknownSide,
    },
    occupiedGroups,
    presentModifierIds,
    missingModifierIds,
  };
}
