'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { isTechLoggedIn, clearTechTokens } from '../../../lib/techApi';

export default function TechShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!isTechLoggedIn()) {
      router.replace('/tech/login');
    } else {
      setReady(true);
    }
  }, [router]);

  if (!ready) return null;

  return (
    <div className="min-h-screen">
      <header className="bg-blue-700 text-white sticky top-0 z-10">
        <div className="max-w-xl mx-auto flex items-center justify-between p-4">
          <span className="font-bold">My Jobs / मेरे काम</span>
          <button
            onClick={() => {
              clearTechTokens();
              router.push('/tech/login');
            }}
            className="text-sm underline"
          >
            Logout
          </button>
        </div>
      </header>
      <main className="max-w-xl mx-auto p-4">{children}</main>
    </div>
  );
}
