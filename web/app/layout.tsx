import './globals.css';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'RO Service Reports',
  description: 'RO service reports and admin panel',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
