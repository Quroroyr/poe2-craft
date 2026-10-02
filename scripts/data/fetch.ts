/**
 * RAW SNAPSHOT step of the game-data pipeline:  upstream → data/raw/<source>/ + data/raw/manifest.json
 *
 * - RePoE PoE 2 export (repoe-fork/poe2): pinned to a git commit, so a snapshot can be fetched again
 *   byte for byte (`--pinned` reuses the revision written in the manifest).
 * - Official trade2 reference data (pathofexile.com): not versioned upstream; captured with a time stamp.
 *
 * The raw files are not committed (they are large and owned by GGG); the manifest is, with the
 * revision, URL, size and sha256 of every file. Run with Node ≥ 23 (TypeScript type stripping).
 *
 *   node scripts/data/fetch.ts            # newest upstream revision
 *   node scripts/data/fetch.ts --pinned   # the revision recorded in data/raw/manifest.json
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const RAW = join(ROOT, 'data', 'raw');
const MANIFEST = join(RAW, 'manifest.json');
const USER_AGENT = 'poe2-craft-planner/0.8 (private crafting tool; github.com/Quroroyr/poe2-craft)';

const REPOE_REPO = 'repoe-fork/poe2';
const REPOE_FILES = ['base_items.json', 'mods.json', 'item_classes.json', 'tags.json', 'augments.json', 'mods_by_base.json'];
const TRADE2_FILES = ['static', 'items', 'stats'];

interface RawFile {
  readonly path: string;
  readonly url: string;
  readonly bytes: number;
  readonly sha256: string;
}

interface RawSource {
  readonly id: string;
  readonly title: string;
  readonly kind: 'game-data' | 'official';
  readonly repository?: string;
  readonly revision: string | null;
  readonly gameClientVersion: string | null;
  readonly license: string;
  readonly fetchedAt: string;
  readonly files: readonly RawFile[];
}

interface Manifest {
  readonly note: string;
  readonly sources: readonly RawSource[];
}

async function get(url: string): Promise<Buffer> {
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText} — ${url}`);
  return Buffer.from(await response.arrayBuffer());
}

function save(dir: string, name: string, url: string, body: Buffer): RawFile {
  mkdirSync(join(RAW, dir), { recursive: true });
  writeFileSync(join(RAW, dir, name), body);
  return { path: `${dir}/${name}`, url, bytes: body.length, sha256: createHash('sha256').update(body).digest('hex') };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function repoeRevision(pinned: boolean): Promise<string> {
  if (pinned && existsSync(MANIFEST)) {
    const previous = JSON.parse(readFileSync(MANIFEST, 'utf8')) as Manifest;
    const revision = previous.sources.find((s) => s.id === 'repoe-poe2')?.revision;
    if (revision) return revision;
  }
  const commits = JSON.parse((await get(`https://api.github.com/repos/${REPOE_REPO}/commits?per_page=1`)).toString('utf8')) as {
    sha: string;
  }[];
  const sha = commits[0]?.sha;
  if (!sha) throw new Error('no upstream revision for RePoE');
  return sha;
}

async function fetchRepoe(pinned: boolean): Promise<RawSource> {
  const revision = await repoeRevision(pinned);
  const base = `https://raw.githubusercontent.com/${REPOE_REPO}/${revision}`;
  const version = (await get(`${base}/version.txt`)).toString('utf8').trim();
  const files: RawFile[] = [];
  for (const name of REPOE_FILES) {
    const url = `${base}/data/${name}`;
    files.push(save('repoe-poe2', name, url, await get(url)));
    process.stdout.write(`  repoe ${name}\n`);
  }
  return {
    id: 'repoe-poe2',
    title: 'RePoE — PoE 2 export of the game client data',
    kind: 'game-data',
    repository: `https://github.com/${REPOE_REPO}`,
    revision,
    gameClientVersion: version,
    license:
      'RePoE tooling: MIT (github.com/repoe-fork/repoe). Exported data: owned by Grinding Gear Games, used under their terms for a non-commercial fan tool.',
    fetchedAt: new Date().toISOString(),
    files,
  };
}

async function fetchTrade2(): Promise<RawSource> {
  const files: RawFile[] = [];
  for (const name of TRADE2_FILES) {
    const url = `https://www.pathofexile.com/api/trade2/data/${name}`;
    files.push(save('trade2', `${name}.json`, url, await get(url)));
    process.stdout.write(`  trade2 ${name}\n`);
    await sleep(3000); // the trade API rate-limits; one request per few seconds is plenty
  }
  return {
    id: 'official-trade2',
    title: 'Official PoE 2 trade reference data (static, items, stats)',
    kind: 'official',
    revision: null,
    gameClientVersion: null,
    license: 'Grinding Gear Games public trade API; reference data for a non-commercial fan tool.',
    fetchedAt: new Date().toISOString(),
    files,
  };
}

async function main() {
  const pinned = process.argv.includes('--pinned');
  process.stdout.write(`fetching raw game data${pinned ? ' (pinned revision)' : ''}…\n`);
  const sources = [await fetchRepoe(pinned), await fetchTrade2()];
  const manifest: Manifest = {
    note: 'Raw upstream snapshots used by scripts/data/normalize.ts. The JSON files are not committed; fetch them again with `pnpm data:fetch --pinned`.',
    sources,
  };
  writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
  for (const s of sources) process.stdout.write(`${s.id}: ${s.files.length} files, revision ${s.revision ?? 'n/a'}, client ${s.gameClientVersion ?? 'n/a'}\n`);
}

await main();
