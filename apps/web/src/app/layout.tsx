import type { Metadata } from 'next';
import { Alegreya_SC } from 'next/font/google';
import './globals.css';
import './planner.css';
import { publicUrl } from '@/lib/site';

/** Small-caps book face for item names, close to how the game sets them. Self-hosted by next/font. */
const itemFace = Alegreya_SC({
  weight: ['400', '500'],
  subsets: ['latin', 'cyrillic'],
  display: 'swap',
  variable: '--font-item-face',
});

export const metadata: Metadata = {
  title: 'PoE 2 Craft Planner',
  description: 'Path of Exile 2 crafting planner: import or build an item, craft by clicking it, modifier pool, chances and stage cost.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // The background is a public file: its URL carries the base path of a GitHub Pages build.
    <html lang="en" className={itemFace.variable} style={{ '--workshop-image': `url('${publicUrl('/img/workshop.webp')}')` } as React.CSSProperties}>
      <body>{children}</body>
    </html>
  );
}
