import type { NextConfig } from 'next';

/**
 * GitHub Pages build (.github/workflows/pages.yml): NEXT_PUBLIC_STATIC_SITE=1 exports plain files
 * served under NEXT_PUBLIC_BASE_PATH (/poe2-craft). The /api/prices route is a server feature and is
 * left out of that build; the page then reads the price snapshot taken at build time.
 */
const staticSite = process.env.NEXT_PUBLIC_STATIC_SITE === '1';
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

const nextConfig: NextConfig = {
  ...(staticSite ? { output: 'export' as const, trailingSlash: true, images: { unoptimized: true } } : {}),
  ...(basePath ? { basePath } : {}),
  // The dev server is opened as http://127.0.0.1:<port>; Next 16 blocks its dev resources (HMR,
  // client chunks' dev helpers) for any host not listed here, which leaves the page unhydrated.
  allowedDevOrigins: ['127.0.0.1'],
  // Next 16 writes AGENTS.md / CLAUDE.md into the app on `next dev`; the repo keeps its own.
  agentRules: false,
  // Core packages are shipped as TypeScript source inside the workspace.
  transpilePackages: [
    '@poe2-craft/craft-domain',
    '@poe2-craft/craft-db',
    '@poe2-craft/item-parser',
    '@poe2-craft/probability-engine',
    '@poe2-craft/economy',
    '@poe2-craft/craft-session',
  ],
};

export default nextConfig;
