'use client';

// Thin fetch wrapper for the admin panel. Tokens are kept in memory + sessionStorage
// (not localStorage) to reduce the window an XSS payload has to exfiltrate them,
// and every request auto-retries once after a silent refresh on a 401.

const API_URL = process.env.NEXT_PUBLIC_API_URL as string;

function getAccessToken() {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem('accessToken');
}
function getRefreshToken() {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem('refreshToken');
}
export function setTokens(accessToken: string, refreshToken: string) {
  sessionStorage.setItem('accessToken', accessToken);
  sessionStorage.setItem('refreshToken', refreshToken);
}
export function clearTokens() {
  sessionStorage.removeItem('accessToken');
  sessionStorage.removeItem('refreshToken');
}
export function isLoggedIn() {
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
  sessionStorage.setItem('accessToken', data.accessToken);
  return data.accessToken;
}

export async function apiFetch(path: string, options: RequestInit = {}, retry = true): Promise<any> {
  const accessToken = getAccessToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (res.status === 401 && retry) {
    try {
      await refreshAccessToken();
      return apiFetch(path, options, false);
    } catch {
      clearTokens();
      if (typeof window !== 'undefined') window.location.href = '/admin/login';
      throw new Error('Session expired');
    }
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}
