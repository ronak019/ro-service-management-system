'use client';

// Separate token storage from the admin panel (different keys) so a phone
// browser can, in theory, have both open without one login clobbering the
// other. Same refresh-on-401 pattern as lib/api.ts.

const API_URL = process.env.NEXT_PUBLIC_API_URL as string;

function getAccessToken() {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem('techAccessToken');
}
function getRefreshToken() {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem('techRefreshToken');
}
export function setTechTokens(accessToken: string, refreshToken: string) {
  sessionStorage.setItem('techAccessToken', accessToken);
  sessionStorage.setItem('techRefreshToken', refreshToken);
}
export function clearTechTokens() {
  sessionStorage.removeItem('techAccessToken');
  sessionStorage.removeItem('techRefreshToken');
}
export function isTechLoggedIn() {
  return !!getAccessToken();
}

async function refreshAccessToken() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) throw new Error('No refresh token');
  const res = await fetch(`${API_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) throw new Error('Session expired');
  const data = await res.json();
  sessionStorage.setItem('techAccessToken', data.accessToken);
  return data.accessToken;
}

export async function techApiFetch(path: string, options: RequestInit = {}, retry = true): Promise<any> {
  const accessToken = getAccessToken();
  const headers: Record<string, string> = { ...(options.headers as Record<string, string>) };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (res.status === 401 && retry) {
    try {
      await refreshAccessToken();
      return techApiFetch(path, options, false);
    } catch {
      clearTechTokens();
      if (typeof window !== 'undefined') window.location.href = '/tech/login';
      throw new Error('Session expired');
    }
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}
