/** One base, one canonical art everywhere; unknown art falls back to a placeholder of the same footprint. */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ArtFrame } from '@/components/ItemBits';
import { ItemArt } from '@/components/ItemArt';
import { craftDb, DEFAULT_GAME_VERSION, importSource, importTarget } from './analyze';
import { baseArt, resolveArt } from './icons';
import { SAMPLE_ITEMS, SAMPLE_TARGET_ITEMS } from '@poe2-craft/item-parser';
import { createItemFromBase } from '@poe2-craft/craft-session';

const view = craftDb.forVersion(DEFAULT_GAME_VERSION);

describe('item art', () => {
  it('source, current and target of the same base resolve to the same image', () => {
    const imported = importSource(SAMPLE_ITEMS[0]!.text, DEFAULT_GAME_VERSION)!;
    const built = createItemFromBase(view, 'base.akoyan-spear', 82)!;
    const target = importTarget(SAMPLE_TARGET_ITEMS[0]!.text, DEFAULT_GAME_VERSION)!;
    const srcs = [imported.baseId, built.baseId, target.baseId].map((id) => baseArt(view.getBase(id!))?.src);
    expect(new Set(srcs)).toEqual(new Set(['/icons/game/1HSpear10.png']));
  });

  it('every base of the catalog has its own local art entry', () => {
    for (const base of view.listBases()) expect(baseArt(base), base.id).not.toBeNull();
  });

  it('falls back to a placeholder when the art is unknown', () => {
    expect(resolveArt('Art/2DItems/Nothing/Here')).toBeNull();
    expect(resolveArt(undefined)).toBeNull();
    const html = renderToStaticMarkup(<ItemArt art={null} label="x" maxHeight={120} />);
    expect(html).toContain('item-art-missing');
    expect(html).toContain('height:120px');
    expect(renderToStaticMarkup(<ArtFrame base={undefined} label="x" glow="gold" maxHeight={100} />)).toContain('нет изображения');
  });

  it('never scales art up beyond its intrinsic size', () => {
    const art = baseArt(view.getBase('base.akoyan-spear'))!;
    const html = renderToStaticMarkup(<ItemArt art={art} label="spear" maxHeight={400} />);
    expect(html).toContain(`width="${art.width}"`);
    expect(html).toContain(`height="${art.height}"`);
  });
});
