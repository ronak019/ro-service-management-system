'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { isTechLoggedIn, clearTechTokens } from '../../../lib/techApi';
import { syncOfflineQueue } from '../../../lib/offlineSync';
import { enablePushNotifications, isPushEnabled, pushSupported } from '../../../lib/push';

export default function TechShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [pushEnabled, setPushEnabled] = useState(true); // assume enabled until checked, to avoid a flash of the prompt
  const [pushLoading, setPushLoading] = useState(false);
  const [pushError, setPushError] = useState('');

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
    trySync();
    window.addEventListener('online', trySync);
    const interval = setInterval(trySync, 20000);

    isPushEnabled().then(setPushEnabled);

    return () => {
      window.removeEventListener('online', trySync);
      clearInterval(interval);
    };
  }, [ready]);

  async function handleEnablePush() {
    setPushLoading(true);
    setPushError('');
    try {
      const result = await enablePushNotifications();
      if (result === 'granted') {
        setPushEnabled(true);
      } else if (result === 'denied') {
        setPushError('Permission denied — phone settings mein jaake allow karein / Enable it in phone settings');
      } else {
        setPushError('Yeh phone/browser notifications support nahi karta');
      }
    } catch (e: any) {
      setPushError(e.message || 'Kuch galat ho gaya');
    } finally {
      setPushLoading(false);
    }
  }

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

      {pushSupported() && !pushEnabled && (
        <div className="max-w-xl mx-auto px-4 pt-3">
          <button
            onClick={handleEnablePush}
            disabled={pushLoading}
            className="w-full bg-indigo-600 text-white rounded-lg p-3 font-medium disabled:opacity-50"
          >
            {pushLoading ? 'Enabling...' : '🔔 Notifications On Karein / Enable Notifications'}
          </button>
          {pushError && <p className="text-red-600 text-sm mt-1">{pushError}</p>}
        </div>
      )}

      <main className="max-w-xl mx-auto p-4">{children}</main>
    </div>
  );
}
