/**
 * Resolves art ids from CraftDB records to the local images listed in art-manifest.ts.
 * Components ask here; they never build image paths themselves.
 */
import type { Consumable, ItemBase } from '@poe2-craft/craft-domain';
import type { CraftDbView } from '@poe2-craft/craft-db';
import { ART_MANIFEST, type ArtAsset } from './art-manifest';

export const ICON_DIR = '/icons/game';

export interface ResolvedArt extends ArtAsset {
  readonly src: string;
}

export function resolveArt(artId: string | undefined): ResolvedArt | null {
  const asset = artId ? ART_MANIFEST[artId] : undefined;
  return asset ? { ...asset, src: `${ICON_DIR}/${asset.file}` } : null;
}

export function iconUrlForArt(art: string | undefined): string | null {
  return resolveArt(art)?.src ?? null;
}

export function consumableIconUrl(consumable: Consumable | undefined): string | null {
  return iconUrlForArt(consumable?.art);
}

export function baseArt(base: ItemBase | undefined): ResolvedArt | null {
  return resolveArt(base?.artAssetId);
}

/** Price units are named after the currency they are counted in. */
const UNIT_CONSUMABLE: Readonly<Record<string, string>> = {
  div: 'currency.divine-orb',
};

export function unitIconUrl(unit: string, view: CraftDbView): string | null {
  const id = UNIT_CONSUMABLE[unit];
  return id ? consumableIconUrl(view.getConsumable(id)) : null;
}
