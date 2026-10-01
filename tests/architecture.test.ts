/**
 * Guards the architecture boundaries from docs/crafting-invariants.md.
 * Cheap static checks: they read package manifests and import statements.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('..', import.meta.url));
const packagesDir = join(root, 'packages');
const packages = readdirSync(packagesDir).filter((name) => statSync(join(packagesDir, name)).isDirectory());

/** Allowed runtime dependencies between core packages (dependency direction). */
const ALLOWED: Record<string, string[]> = {
  'craft-domain': [],
  'craft-db': ['craft-domain'],
  'item-parser': ['craft-domain'],
  'probability-engine': ['craft-domain', 'craft-db'],
  economy: ['craft-domain', 'probability-engine'],
};

const UI_PACKAGES = /^(react|react-dom|next)(\/|$)/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(name) ? [path] : [];
  });
}

function imports(file: string): string[] {
  const text = readFileSync(file, 'utf8');
  return [...text.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)].map((m) => m[1] ?? '');
}

describe('architecture boundaries', () => {
  it('every core package is covered by the dependency rules', () => {
    expect(packages.sort()).toEqual(Object.keys(ALLOWED).sort());
  });

  for (const pkg of packages) {
    const manifest = JSON.parse(readFileSync(join(packagesDir, pkg, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>;
    };
    const deps = Object.keys(manifest.dependencies ?? {});

    it(`${pkg} has no React/Next.js dependency`, () => {
      expect(deps.filter((d) => UI_PACKAGES.test(d))).toEqual([]);
      for (const file of sourceFiles(join(packagesDir, pkg, 'src'))) {
        expect(imports(file).filter((i) => UI_PACKAGES.test(i)), file).toEqual([]);
      }
    });

    it(`${pkg} only depends on allowed core packages`, () => {
      const internal = deps.filter((d) => d.startsWith('@poe2-craft/')).map((d) => d.slice('@poe2-craft/'.length));
      expect(internal.filter((d) => !ALLOWED[pkg]?.includes(d))).toEqual([]);

      // Test files may use other packages (e.g. fixtures); production sources may not.
      for (const file of sourceFiles(join(packagesDir, pkg, 'src')).filter((f) => !f.endsWith('.test.ts'))) {
        const used = imports(file)
          .filter((i) => i.startsWith('@poe2-craft/'))
          .map((i) => i.slice('@poe2-craft/'.length).split('/')[0] ?? '');
        expect(used.filter((d) => !ALLOWED[pkg]?.includes(d)), file).toEqual([]);
      }
    });
  }
});
