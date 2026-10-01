/**
 * Maps game art ids from CraftDB to icons stored in /public/icons/game.
 * Files were downloaded from GGG's official CDN (web.poecdn.com) via the PoE 2 trade
 * static data; the file name is the last segment of the art id. Icons © Grinding Gear Games.
 */
import type { Consumable } from '@poe2-craft/craft-domain';
import type { CraftDbView } from '@poe2-craft/craft-db';

export const ICON_DIR = '/icons/game';

export function iconUrlForArt(art: string | undefined): string | null {
  const file = art?.split('/').pop();
  return file ? `${ICON_DIR}/${file}.png` : null;
}

export function consumableIconUrl(consumable: Consumable | undefined): string | null {
  return iconUrlForArt(consumable?.art);
}

/** Price units are named after the currency they are counted in. */
const UNIT_CONSUMABLE: Readonly<Record<string, string>> = {
  div: 'currency.divine-orb',
};

export function unitIconUrl(unit: string, view: CraftDbView): string | null {
  const id = UNIT_CONSUMABLE[unit];
  return id ? consumableIconUrl(view.getConsumable(id)) : null;
}
