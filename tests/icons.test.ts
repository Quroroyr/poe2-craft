/**
 * Every art id CraftDB names (consumables and bases) must have a manifest entry with its source
 * and a local file shipped with the web app — the site never hotlinks game art.
 */
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { akoyanSpearFixture } from '@poe2-craft/craft-db';
import { ART_MANIFEST } from '../apps/web/src/lib/art-manifest';

const iconDir = fileURLToPath(new URL('../apps/web/public/icons/game/', import.meta.url));

const artIds = [
  ...akoyanSpearFixture.consumables.map((c) => ({ owner: c.id, art: c.art })),
  ...akoyanSpearFixture.bases.map((b) => ({ owner: b.id, art: b.artAssetId })),
];

describe('game art', () => {
  for (const { owner, art } of artIds) {
    it(`${owner} has a local image with recorded origin`, () => {
      expect(art, 'art id').toBeTruthy();
      const asset = ART_MANIFEST[art ?? ''];
      expect(asset, `manifest entry for ${art}`).toBeDefined();
      expect(existsSync(iconDir + asset!.file), asset!.file).toBe(true);
      expect(asset!.origin).toMatch(/^https:\/\/web\.poecdn\.com\//);
    });
  }

  it('lists no art the data does not use', () => {
    const used = new Set(artIds.map((a) => a.art));
    expect(Object.keys(ART_MANIFEST).filter((id) => !used.has(id))).toEqual([]);
  });
});
