import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, readdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { economyLeagues, economySnapshot, normalizeOverview, PRICE_TYPES } from './poe-ninja';
let cache: string | undefined;
afterEach(async () => { vi.unstubAllGlobals(); if (cache) await rm(cache, { recursive: true, force: true }); cache = undefined; });
describe('poe.ninja infrastructure', () => {
  it('uses primaryValue directly in the primary currency and omits invalid prices', () => {
    expect(normalizeOverview({ core:{ primary:'divine', rates:{ chaos:99 } },lines:[{id:'exalted',primaryValue:0.012},{id:'bad',primaryValue:null},{id:'negative',primaryValue:-1}] })).toEqual({unit:'div',prices:{divine:1,exalted:0.012}});
    expect(() => normalizeOverview({lines:[]})).toThrow('Invalid');
  });
  it('deduplicates concurrent league requests, caches for five minutes and sends ETag on revalidation', async () => {
    cache = await mkdtemp(join(tmpdir(),'poe-ninja-test-'));
    const fetcher = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify([{id:'Test',name:'Test'}]),{headers:{etag:'version-one','cache-control':'max-age=1'}})).mockResolvedValueOnce(new Response(null,{status:304}));
    vi.stubGlobal('fetch',fetcher);
    await Promise.all([economyLeagues(cache),economyLeagues(cache)]);
    await economyLeagues(cache); expect(fetcher).toHaveBeenCalledTimes(1);
    const file = join(cache,(await readdir(cache))[0]!);
    const entry = JSON.parse(await readFile(file,'utf8')); expect(entry.ttl).toBe(300_000);
    entry.checkedAt = 0; await writeFile(file,JSON.stringify(entry));
    expect(await economyLeagues(cache)).toEqual([{id:'Test',name:'Test'}]);
    expect(fetcher.mock.calls[1]![1].headers['If-None-Match']).toBe('version-one');
    expect(fetcher.mock.calls[0]![1].headers['User-Agent']).toContain('PoE2CraftPlanner');
  });
  it('assembles all categories, rejects unlisted leagues and keeps acquisition time separate from game version', async () => {
    cache = await mkdtemp(join(tmpdir(),'poe-ninja-test-'));
    const fetcher = vi.fn(async (url:string) => new Response(JSON.stringify(url.endsWith('/leagues') ? [{id:'Test',name:'Test'}] : {core:{primary:'divine'},lines:[{id:new URL(url).searchParams.get('type'),primaryValue:2}]})));
    vi.stubGlobal('fetch',fetcher);
    const snapshot = await economySnapshot('Test',cache);
    expect(snapshot.source).toBe('poe.ninja'); expect(snapshot.league).toBe('Test'); expect(snapshot.unit).toBe('div');
    expect(Object.keys(snapshot.prices)).toHaveLength(PRICE_TYPES.length+1);
    expect(Number.isNaN(Date.parse(snapshot.capturedAt))).toBe(false);
    await expect(economySnapshot('Unknown',cache)).rejects.toThrow('Unknown economy league');
    expect(fetcher).toHaveBeenCalledTimes(PRICE_TYPES.length+1);
  });
});
