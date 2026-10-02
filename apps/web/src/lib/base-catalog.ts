/** Search, class filter and sort of the base selector. Presentation only: no game rules here. */
import type { ItemBase, ItemClass, ItemClassId } from '@poe2-craft/craft-domain';
import type { CraftDbView } from '@poe2-craft/craft-db';

export type BaseSort = 'name' | 'level';

export interface BaseQuery {
  readonly text: string;
  /** null = all classes. */
  readonly classId: ItemClassId | null;
  readonly sort: BaseSort;
}

export interface BaseCatalogEntry {
  readonly base: ItemBase;
  readonly itemClass: ItemClass | undefined;
}

export interface ClassFacet {
  readonly itemClass: ItemClass;
  readonly count: number;
}

export function classFacets(view: CraftDbView): ClassFacet[] {
  const bases = view.listBases();
  return view
    .listItemClasses()
    .map((itemClass) => ({ itemClass, count: bases.filter((b) => b.itemClassId === itemClass.id).length }))
    .filter((f) => f.count > 0);
}

export function searchBases(view: CraftDbView, query: BaseQuery): BaseCatalogEntry[] {
  const text = query.text.trim().toLowerCase();
  const entries = view
    .listBases()
    .filter((base) => query.classId === null || base.itemClassId === query.classId)
    .map((base) => ({ base, itemClass: view.getItemClass(base.itemClassId) }))
    .filter(({ base, itemClass }) => {
      if (!text) return true;
      return [base.name, itemClass?.name ?? '', itemClass?.clipboardName ?? ''].some((s) => s.toLowerCase().includes(text));
    });
  const level = (b: ItemBase) => b.details?.requirements.level ?? 0;
  return entries.sort((a, b) =>
    query.sort === 'level'
      ? level(a.base) - level(b.base) || a.base.name.localeCompare(b.base.name)
      : a.base.name.localeCompare(b.base.name),
  );
}
