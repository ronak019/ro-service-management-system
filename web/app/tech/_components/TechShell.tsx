'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { isTechLoggedIn, clearTechTokens } from '../../../lib/techApi';
import { syncOfflineQueue } from '../../../lib/offlineSync';

export default function TechShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (!isTechLoggedIn()) {
      router.replace('/tech/login');
    } else {
      setReady(true);
    }
  }, [router]);

  useEffect(() => {
    if (!ready) return;

    async function trySync() {
      const { remaining } = await syncOfflineQueue();
      setPendingCount(remaining);
    }

    trySync(); // attempt immediately on load
    window.addEventListener('online', trySync);
    // Some mobile browsers don't fire 'online' reliably — poll as a backup.
    const interval = setInterval(trySync, 20000);

    return () => {
      window.removeEventListener('online', trySync);
      clearInterval(interval);
    };
  }, [ready]);

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
        {pendingCount > 0 && (
          <div className="bg-amber-500 text-white text-sm text-center py-1">
            📤 {pendingCount} item{pendingCount > 1 ? 's' : ''} waiting to upload — internet aane par apne aap chala jaayega
          </div>
        )}
      </header>
      <main className="max-w-xl mx-auto p-4">{children}</main>
    </div>
  );
}
