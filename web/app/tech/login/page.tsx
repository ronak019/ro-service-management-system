'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { setTechTokens } from '../../../lib/techApi';

export default function TechLoginPage() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      if (data.user.role !== 'technician') throw new Error('This login is for technicians only');
      setTechTokens(data.accessToken, data.refreshToken);
      router.replace('/tech/jobs');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded shadow w-full max-w-sm space-y-3">
        <h1 className="text-xl font-bold mb-1">Technician Login</h1>
        <p className="text-sm text-gray-500 mb-2">तकनीशियन लॉगिन</p>
        <input
          className="w-full border rounded p-3 text-base"
          placeholder="Phone / फ़ोन नंबर"
          inputMode="numeric"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
        />
        <input
          className="w-full border rounded p-3 text-base"
          placeholder="Password / पासवर्ड"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button
          disabled={loading}
          className="w-full bg-blue-600 text-white rounded p-3 text-base font-medium disabled:opacity-50"
        >
          {loading ? 'Signing in...' : 'Login / लॉगिन करें'}
        </button>
        {error && <p className="text-red-600 text-sm">{error}</p>}
      </form>
    </div>
  );
}
