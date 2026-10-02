/** Local game art, fetched once. No runtime hotlinks. Node >=23. */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
const root = new URL('../../', import.meta.url);
const data = JSON.parse(await readFile(new URL('packages/craft-db/src/production/poe2-data.json', root), 'utf8'));
const artIds: string[] = [...new Set<string>([...data.bases.map((b: any) => b.artAssetId), ...data.consumables.map((c: any) => c.art)].filter(Boolean))].sort();
const directory = new URL('apps/web/public/art/', root);
await mkdir(directory, { recursive: true });
const manifest: Record<string, unknown> = {};
const failed: { id: string; reason: string }[] = [];
let index = 0; let bytes = 0;
async function worker() {
  while (index < artIds.length) {
    const id = artIds[index++]!;
    const file = `${createHash('sha256').update(id).digest('hex').slice(0,24)}.png`;
    const origin = `https://repoe-fork.github.io/poe2/${id}.png`;
    try {
      let buffer: Buffer;
      try { buffer = await readFile(new URL(file, directory)); }
      catch {
        const response = await fetch(origin, { signal: AbortSignal.timeout(30_000) });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        buffer = Buffer.from(await response.arrayBuffer());
      }
      if (buffer.length < 24 || !buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) throw new Error('Not PNG');
      const width = buffer.readUInt32BE(16), height = buffer.readUInt32BE(20);
      if (!width || !height) throw new Error('Invalid size');
      await writeFile(new URL(file, directory), buffer);
      bytes += buffer.length;
      manifest[id] = { file, width, height, source: 'repoe-poe2', origin, sha256: createHash('sha256').update(buffer).digest('hex') };
    } catch (e) { failed.push({ id, reason: String(e) }); }
    if (index % 100 === 0) process.stdout.write(`${index}/${artIds.length}\n`);
  }
}
await Promise.all([worker(), worker(), worker(), worker()]);
const ordered = Object.fromEntries(Object.entries(manifest).sort(([a],[b]) => a.localeCompare(b)));
await writeFile(new URL('apps/web/src/lib/production-art.json', root), JSON.stringify(ordered, null, 2)+'\n');
const report = { upstream: data.upstream, requested: artIds.length, downloaded: Object.keys(manifest).length, bytes, failed: failed.sort((a,b) => a.id.localeCompare(b.id)) };
await writeFile(new URL('data/art-report.json', root), JSON.stringify(report, null, 2)+'\n');
process.stdout.write(`Art: ${report.downloaded}/${report.requested}; ${bytes} bytes; missing ${failed.length}\n`);
if (failed.length) process.exitCode = 1;
