/**
 * Where the site is served from. The default is the Node server (`pnpm start`) at the domain root.
 * The GitHub Pages build is a static export under /<repo>: NEXT_PUBLIC_BASE_PATH prefixes every
 * public file, and NEXT_PUBLIC_STATIC_SITE=1 replaces the /api/prices proxy with the price snapshot
 * taken at build time (poe.ninja sends no CORS headers, so a browser cannot ask it directly).
 */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
export const STATIC_SITE = process.env.NEXT_PUBLIC_STATIC_SITE === '1';

/** URL of a file in `public/`, e.g. publicUrl('/art/x.png'). */
export const publicUrl = (path: string) => `${BASE_PATH}${path}`;
