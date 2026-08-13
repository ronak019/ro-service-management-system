'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { isLoggedIn, clearTokens } from '../../../lib/api';

const NAV = [
  { href: '/admin/dashboard', label: 'Dashboard' },
  { href: '/admin/jobs', label: 'Jobs' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/complaints', label: 'Complaints' },
];

export default function AdminShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace('/admin/login');
    } else {
      setReady(true);
    }
  }, [router]);

  if (!ready) return null; // avoid flashing protected content pre-redirect

  return (
    <div className="min-h-screen">
      <header className="bg-gray-900 text-white">
        <div className="max-w-6xl mx-auto flex items-center justify-between p-4">
          <span className="font-bold">RO Admin</span>
          <nav className="flex gap-4 text-sm">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="hover:underline">
                {n.label}
              </Link>
            ))}
            <button
              onClick={() => {
                clearTokens();
                router.push('/admin/login');
              }}
              className="hover:underline"
            >
              Logout
            </button>
          </nav>
        </div>
      </header>
      <main className="max-w-6xl mx-auto p-4">{children}</main>
    </div>
  );
}
