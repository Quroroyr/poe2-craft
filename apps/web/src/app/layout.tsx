import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PoE 2 Craft Planner',
  description: 'Разбор предмета Path of Exile 2, пул модов, вероятность и стоимость этапа крафта',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
