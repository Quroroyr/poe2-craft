import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
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
