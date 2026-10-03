/**
 * User-facing navigation over the base catalog: Category → (Group) → Base.
 *
 * Built on the data layer (`baseVisibility`, `defenceArchetype` in craft-db): only player-facing bases
 * of classes the engine can craft are listed. The hierarchy is presentation — it never changes
 * ItemClass or the dataset. Category of a class:
 * - accessory classes → jewellery;
 * - weapon classes → one- or two-handed by the hand tags of their bases (`onehand` / `one_hand_weapon`,
 *   `twohand` / `two_hand_weapon`);
 * - armour classes → body slots when their bases carry a slot tag (body armour, helmet, gloves,
 *   boots), otherwise off-hand (shields, bucklers, foci, quivers).
 * Defence classes with more than one archetype get a group step (STR, STR/INT…); others go
 * straight to their bases. Weapon categories list classes as their group step.
 */
import type { ItemBase, ItemClass } from '@poe2-craft/craft-domain';
import { DEFENCE_ARCHETYPES, defenceArchetype, isPlayerFacing, type CraftDbView, type DefenceArchetype } from '@poe2-craft/craft-db';

export type NavCategoryId = 'armour' | 'offhand' | 'jewellery' | 'one-handed' | 'two-handed';
export const NAV_CATEGORY_ORDER: readonly NavCategoryId[] = ['armour', 'jewellery', 'one-handed', 'two-handed', 'offhand'];
/** Step-1 sections: weapons are one section with two tiles. */
export type NavSectionId = 'armour' | 'jewellery' | 'weapons' | 'offhand';

export type NavGroupId = DefenceArchetype | 'special';

export interface NavGroup {
  readonly id: NavGroupId;
  readonly bases: readonly ItemBase[];
}

export interface NavClass {
  readonly itemClass: ItemClass;
  /** null = the class has one kind of base: no group step. */
  readonly groups: readonly NavGroup[] | null;
  readonly bases: readonly ItemBase[];
}

export interface NavCategory {
  readonly id: NavCategoryId;
  readonly section: NavSectionId;
  readonly classes: readonly NavClass[];
}

export interface BaseNavigation {
  readonly categories: readonly NavCategory[];
  /** Player-facing, craftable bases shown anywhere in the tree. */
  readonly bases: readonly ItemBase[];
}

const SLOT_TAGS = ['body_armour', 'helmet', 'gloves', 'boots'];
const level = (b: ItemBase) => b.dropLevel ?? b.details?.requirements.level ?? 0;
export const byLevel = (a: ItemBase, b: ItemBase) => level(a) - level(b) || a.name.localeCompare(b.name);

function categoryOf(itemClass: ItemClass, bases: readonly ItemBase[]): NavCategoryId | null {
  const share = (...tags: string[]) => bases.filter((b) => tags.some((t) => b.tags.includes(t))).length;
  switch (itemClass.category) {
    case 'accessory':
      return 'jewellery';
    case 'weapon':
      return share('twohand', 'two_hand_weapon') > share('onehand', 'one_hand_weapon') ? 'two-handed' : 'one-handed';
    case 'armour':
      return bases.some((b) => SLOT_TAGS.some((t) => b.tags.includes(t))) ? 'armour' : 'offhand';
    default:
      return null;
  }
}

function groupsOf(bases: readonly ItemBase[]): NavGroup[] | null {
  const byGroup = new Map<NavGroupId, ItemBase[]>();
  for (const base of bases) {
    const archetype = defenceArchetype(base).archetype;
    if (archetype === null) return null;
    byGroup.set(archetype, [...(byGroup.get(archetype) ?? []), base]);
  }
  if (byGroup.size < 2) return null;
  const order: readonly NavGroupId[] = [...DEFENCE_ARCHETYPES, 'special'];
  return order.filter((id) => byGroup.has(id)).map((id) => ({ id, bases: byGroup.get(id)!.sort(byLevel) }));
}

/** A base the create flow offers: player-facing and of a class the engine can craft. */
export const isOffered = (base: ItemBase) => isPlayerFacing(base) && base.dataStatus !== 'unsupported' && base.dataStatus !== 'imported';

export function buildBaseNavigation(view: CraftDbView): BaseNavigation {
  const offered = view.listBases().filter(isOffered);
  const categories = new Map<NavCategoryId, NavClass[]>();
  for (const itemClass of view.listItemClasses()) {
    const bases = offered.filter((b) => b.itemClassId === itemClass.id).sort(byLevel);
    if (bases.length === 0) continue;
    const category = categoryOf(itemClass, bases);
    if (!category) continue;
    categories.set(category, [...(categories.get(category) ?? []), { itemClass, groups: groupsOf(bases), bases }]);
  }
  return {
    categories: NAV_CATEGORY_ORDER.filter((id) => categories.has(id)).map((id) => ({
      id,
      section: id === 'one-handed' || id === 'two-handed' ? 'weapons' : id,
      classes: categories.get(id)!.sort((a, b) => a.itemClass.name.localeCompare(b.itemClass.name)),
    })),
    bases: offered,
  };
}

/** Where a base sits in the tree, for search results ("Body Armours · STR/INT"). */
export interface BaseLocation {
  readonly category: NavCategoryId;
  readonly itemClass: ItemClass;
  readonly group: NavGroupId | null;
}

export function locateBase(nav: BaseNavigation, baseId: string): BaseLocation | null {
  for (const category of nav.categories) {
    for (const cls of category.classes) {
      if (!cls.bases.some((b) => b.id === baseId)) continue;
      const group = cls.groups?.find((g) => g.bases.some((b) => b.id === baseId))?.id ?? null;
      return { category: category.id, itemClass: cls.itemClass, group };
    }
  }
  return null;
}

/** Name search over the offered bases only (never test, internal or unknown records). */
export function searchOffered(nav: BaseNavigation, text: string, within?: readonly ItemBase[]): ItemBase[] {
  const needle = text.trim().toLowerCase();
  const pool = within ?? nav.bases;
  if (!needle) return [...pool];
  return pool.filter((b) => b.name.toLowerCase().includes(needle)).sort(byLevel);
}

/** Position in the selector: each field narrows the previous one. */
export interface NavPath {
  readonly category: NavCategoryId | null;
  readonly classId: string | null;
  readonly group: NavGroupId | null;
}
export const NAV_ROOT: NavPath = { category: null, classId: null, group: null };

/** Bases at a path when it ends on a list; null while a choice is still to be made. */
export function basesAt(nav: BaseNavigation, path: NavPath): readonly ItemBase[] | null {
  const cls = nav.categories.find((c) => c.id === path.category)?.classes.find((c) => c.itemClass.id === path.classId);
  if (!cls) return null;
  if (cls.groups === null) return cls.bases;
  return cls.groups.find((g) => g.id === path.group)?.bases ?? null;
}

/** One level up, skipping levels that were skipped on the way down (a class without groups). */
export function parentPath(nav: BaseNavigation, path: NavPath): NavPath {
  if (path.group !== null) return { ...path, group: null };
  if (path.classId !== null) {
    const category = nav.categories.find((c) => c.id === path.category);
    // Armour, off-hand and jewellery choose the class on the first screen.
    return category && category.section !== 'weapons' ? NAV_ROOT : { ...path, classId: null };
  }
  return NAV_ROOT;
}
