/** Every consumable that names game art must have its icon file shipped with the web app. */
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { akoyanSpearFixture } from '@poe2-craft/craft-db';

const iconDir = fileURLToPath(new URL('../apps/web/public/icons/game/', import.meta.url));

describe('game icons', () => {
  for (const consumable of akoyanSpearFixture.consumables) {
    it(`${consumable.id} has an icon file`, () => {
      expect(consumable.art, 'art id').toBeTruthy();
      const file = `${consumable.art?.split('/').pop()}.png`;
      expect(existsSync(iconDir + file), file).toBe(true);
    });
  }
});
