import type { Metadata } from 'next';
import { Alegreya_SC } from 'next/font/google';
import './globals.css';
import './workspace.css';
import './workbench.css';

/** Small-caps book face for item names, close to how the game sets them. Self-hosted by next/font. */
const itemFace = Alegreya_SC({
  weight: ['400', '500'],
  subsets: ['latin', 'cyrillic'],
  display: 'swap',
  variable: '--font-item-face',
});

export const metadata: Metadata = {
  title: 'PoE 2 Craft Planner',
  description: 'Сборка исходного предмета, крафт кликом по предмету, пул модов, вероятность и стоимость этапа — Path of Exile 2',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={itemFace.variable}>
      <body>{children}</body>
    </html>
  );
}
