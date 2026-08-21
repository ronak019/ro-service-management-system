'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { isLoggedIn, clearTokens } from '../../../lib/api';

const NAV = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: '📊' },
  { href: '/admin/jobs', label: 'Jobs', icon: '🧰' },
  { href: '/admin/users', label: 'Users', icon: '👥' },
  { href: '/admin/complaints', label: 'Complaints', icon: '📣' },
];

export default function AdminShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace('/admin/login');
    } else {
      setReady(true);
    }
  }, [router]);

  if (!ready) return null;

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Sidebar — fixed on desktop, becomes a top bar list on small screens */}
      <aside className="hidden md:flex md:flex-col md:w-56 md:shrink-0 bg-slate-900 text-white min-h-screen sticky top-0">
        <div className="px-5 py-5 border-b border-slate-700/60">
          <span className="font-bold text-lg tracking-tight">RO Admin</span>
        </div>
        <nav className="flex-1 py-3">
          {NAV.map((n) => {
            const active = pathname?.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`flex items-center gap-3 px-5 py-2.5 text-sm font-medium transition-colors ${
                  active ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <span className="text-base">{n.icon}</span>
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="px-5 py-4 border-t border-slate-700/60">
          <button
            onClick={() => {
              clearTokens();
              router.push('/admin/login');
            }}
            className="text-sm text-slate-300 hover:text-white"
          >
            Logout
          </button>
        </div>
      </aside>

      <div className="flex-1 min-w-0">
        {/* Compact top bar — mobile nav lives here since the sidebar is hidden below md */}
        <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
          <div className="max-w-[1300px] mx-auto flex items-center justify-between px-4 md:px-8 h-14">
            <span className="font-bold md:hidden">RO Admin</span>
            <nav className="flex md:hidden gap-1 overflow-x-auto text-sm">
              {NAV.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className={`px-3 py-1.5 rounded-md whitespace-nowrap ${
                    pathname?.startsWith(n.href) ? 'bg-blue-100 text-blue-700 font-semibold' : 'text-slate-600'
                  }`}
                >
                  {n.label}
                </Link>
              ))}
            </nav>
            <button
              onClick={() => {
                clearTokens();
                router.push('/admin/login');
              }}
              className="md:hidden text-sm text-slate-500"
            >
              Logout
            </button>
            <div className="hidden md:block text-sm text-slate-400">RO Service Management</div>
          </div>
        </header>

        <main className="max-w-[1300px] mx-auto px-4 md:px-8 py-6">{children}</main>
      </div>
    </div>
  );
}
