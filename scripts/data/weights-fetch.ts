/**
 * WEIGHTS RAW SNAPSHOT step:  poe2db.tw  →  data/raw/poe2db/<page>.json + data/raw/poe2db/manifest.json
 *
 * PoE2DB publishes community modifier weightings (compiled by Krakenbul, Prohibited Library, from
 * recombinator experiments; trade listings for bases that cannot be recombined — see
 * https://poe2db.tw/us/weightings). Every item class page embeds the modifier table as the argument of
 * `new ModsView({...})`; classes split by defence type (body armours, helmets…) have one page per
 * attribute option (`Body_Armours_str`, `Body_Armours_str_int`, …) listed in `baseitem.opts`.
 *
 * Only the embedded JSON is stored (the HTML around it is page chrome). The manifest keeps the URL,
 * sha256 of the downloaded HTML, size and time of every page, and the patch PoE2DB reported.
 * robots.txt of poe2db.tw allows crawling; requests are sequential with a pause, and an existing
 * page is not downloaded again unless `--refresh` is given. The app never contacts PoE2DB.
 *
 *   node scripts/data/weights-fetch.ts             # fetch pages missing from the cache
 *   node scripts/data/weights-fetch.ts --refresh   # download every page again
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DIR = join(ROOT, 'data', 'raw', 'poe2db');
const MANIFEST = join(DIR, 'manifest.json');
const DATA = join(ROOT, 'packages', 'craft-db', 'src', 'production', 'poe2-data.json');
const SITE = 'https://poe2db.tw/us/';
const USER_AGENT = 'poe2-craft-planner/0.8 (private crafting tool; github.com/Quroroyr/poe2-craft)';
const PAUSE_MS = 2500;

export interface WeightPageRecord {
  readonly page: string;
  readonly itemClassId: string;
  readonly url: string;
  /** Spawn tag the page is built for (`opt.tags`), when PoE2DB states it. */
  readonly tag: string | null;
  readonly bytes: number;
  readonly sha256: string;
  readonly fetchedAt: string;
}

export interface WeightManifest {
  readonly note: string;
  readonly source: { readonly id: 'poe2db-weightings'; readonly url: string; readonly license: string; readonly method: string };
  readonly gamePatch: string | null;
  readonly fetchedAt: string;
  readonly pages: readonly WeightPageRecord[];
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function getHtml(url: string): Promise<string | null> {
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`${response.status} ${response.statusText} — ${url}`);
  return response.text();
}

/** The object passed to `new ModsView(...)`, or null when the page has no modifier table. */
export function extractModsView(html: string): Record<string, unknown> | null {
  const marker = 'new ModsView(';
  const at = html.indexOf(marker);
  if (at < 0) return null;
  // The argument is a JSON object literal; find its end by bracket depth outside of strings.
  const start = at + marker.length;
  let depth = 0;
  let inString = false;
  for (let i = start; i < html.length; i++) {
    const ch = html[i];
    if (inString) {
      if (ch === '\\') i++;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) return JSON.parse(html.slice(start, i + 1)) as Record<string, unknown>;
  }
  throw new Error('unterminated ModsView object');
}

/**
 * The patch PoE2DB shows as live: the "Running for" link on the home page. Other version links
 * there are history or an announced future patch ("Starts in"), which must not be recorded.
 */
function currentPatch(html: string): string | null {
  return html.match(/href="Version_(\d+\.\d+\.\d+[a-z]?)">Running for/)?.[1] ?? null;
}

async function main() {
  const refresh = process.argv.includes('--refresh');
  mkdirSync(DIR, { recursive: true });
  const previous = existsSync(MANIFEST) ? (JSON.parse(readFileSync(MANIFEST, 'utf8')) as WeightManifest) : null;
  const known = new Map((previous?.pages ?? []).map((p) => [p.page, p]));
  const classes = (JSON.parse(readFileSync(DATA, 'utf8')) as { itemClasses: { id: string; name: string }[] }).itemClasses;

  const pages: WeightPageRecord[] = [];
  let requests = 0;
  const load = async (page: string, itemClassId: string): Promise<Record<string, unknown> | null> => {
    const file = join(DIR, `${page}.json`);
    const cached = known.get(page);
    if (!refresh && cached && existsSync(file)) {
      pages.push(cached);
      return JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
    }
    if (requests++ > 0) await sleep(PAUSE_MS);
    const url = `${SITE}${page}`;
    const html = await getHtml(url);
    if (html === null) return null;
    const view = extractModsView(html);
    if (!view) return null;
    writeFileSync(file, JSON.stringify(view));
    const tag = ((view.opt as { tags?: unknown } | undefined)?.tags as string | undefined) ?? null;
    const record: WeightPageRecord = {
      page, itemClassId, url, tag,
      bytes: Buffer.byteLength(html),
      sha256: createHash('sha256').update(html).digest('hex'),
      fetchedAt: new Date().toISOString(),
    };
    pages.push(record);
    process.stdout.write(`  ${page}${tag ? ` (${tag})` : ''}\n`);
    return view;
  };

  for (const cls of classes) {
    const slug = cls.name.replace(/ /g, '_');
    const view = await load(slug, cls.id);
    if (view) continue;
    // Classes split by attribute: the class page has no table; an attribute page lists all options.
    let options: string[] = [];
    for (const probe of ['str', 'dex', 'int']) {
      const sub = await load(`${slug}_${probe}`, cls.id);
      const opts = (sub?.baseitem as { opts?: Record<string, string> } | undefined)?.opts;
      if (sub && opts) {
        options = Object.keys(opts).filter((o) => o !== probe);
        break;
      }
    }
    for (const option of options) await load(`${slug}_${option}`, cls.id);
    if (!pages.some((p) => p.itemClassId === cls.id)) process.stdout.write(`  ${slug}: no modifier table on PoE2DB\n`);
  }

  if (requests > 0) await sleep(PAUSE_MS);
  const home = await getHtml(SITE);
  const manifest: WeightManifest = {
    note: 'Embedded ModsView tables from poe2db.tw item class pages. Not committed; re-fetch with `pnpm data:weights:fetch`.',
    source: {
      id: 'poe2db-weightings',
      url: `${SITE}weightings`,
      license: 'PoE2DB wiki content: CC BY-NC-SA 3.0. Weightings compiled by Krakenbul (Prohibited Library). Game content © Grinding Gear Games.',
      method: 'Recombinator experiments; trade-listing analysis for bases that cannot be recombined (charms, jewels…). Community data, not extracted from the game client.',
    },
    gamePatch: home ? currentPatch(home) : (previous?.gamePatch ?? null),
    fetchedAt: new Date().toISOString(),
    pages,
  };
  writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
  process.stdout.write(`poe2db: ${pages.length} pages (${requests} requests), patch ${manifest.gamePatch ?? '?'}\n`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main();
