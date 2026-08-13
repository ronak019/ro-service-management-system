// lib/api.js
// Central API client for the technician app: stores tokens in AsyncStorage,
// attaches the access token to every request, and transparently refreshes
// once on a 401 before giving up and forcing a re-login.
import AsyncStorage from '@react-native-async-storage/async-storage';

// Point this at your backend. Use your machine's LAN IP for a physical
// device / emulator during development — "localhost" won't resolve to your
// dev machine from inside an emulator.
export const API_BASE_URL = 'http://YOUR_SERVER_IP:4000/api';

export async function saveTokens(accessToken, refreshToken) {
  await AsyncStorage.multiSet([
    ['accessToken', accessToken],
    ['refreshToken', refreshToken],
  ]);
}

export async function clearTokens() {
  await AsyncStorage.multiRemove(['accessToken', 'refreshToken']);
}

export async function getAccessToken() {
  return AsyncStorage.getItem('accessToken');
}

async function refreshAccessToken() {
  const refreshToken = await AsyncStorage.getItem('refreshToken');
  if (!refreshToken) throw new Error('No refresh token');
  const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) throw new Error('Session expired');
  const data = await res.json();
  await AsyncStorage.setItem('accessToken', data.accessToken);
  return data.accessToken;
}

/**
 * apiFetch(path, options)
 * - path: e.g. '/jobs'
 * - options.body: plain object (auto JSON-stringified) OR a FormData instance
 *   (for file uploads — Content-Type is left for fetch to set with the boundary)
 */
export async function apiFetch(path, options = {}, retry = true) {
  const accessToken = await getAccessToken();
  const isFormData = options.body instanceof FormData;

  const headers = { ...(options.headers || {}) };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  if (!isFormData) headers['Content-Type'] = 'application/json';

  const body = isFormData || !options.body ? options.body : JSON.stringify(options.body);

  const res = await fetch(`${API_BASE_URL}${path}`, { ...options, headers, body });

  if (res.status === 401 && retry) {
    try {
      await refreshAccessToken();
      return apiFetch(path, options, false);
    } catch {
      await clearTokens();
      throw new Error('SESSION_EXPIRED');
    }
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}
