import { Platform } from 'react-native';

export function apiBase() {
  const configured = process.env.EXPO_PUBLIC_SANTA_API_URL;
  const developmentHost = process.env.EXPO_PUBLIC_DOMAIN;
  const value = configured || (developmentHost ? `https://${developmentHost}` : '');
  if (!value || !/^https:\/\/[^/]+\/?$/.test(value)) throw new Error('Set EXPO_PUBLIC_SANTA_API_URL to the HTTPS Santa Radio backend before running on your iPhone.');
  return value.replace(/\/$/, '');
}

export class ApiError extends Error {
  constructor(message: string, public status: number, public availableAt = 0) { super(message); }
}
export async function request(action: string, token?: string, body?: unknown, requestId?: string) {
  if (Platform.OS === 'web') throw new Error('Recording and Apple purchases require the native iPhone app. The browser preview shows the interface only.');
  const response = await fetch(`${apiBase()}/api/santa-mobile?action=${encodeURIComponent(action)}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { Accept: 'application/json, audio/mpeg', ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(requestId ? { 'X-Message-Request-Id': requestId } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: 'omit', cache: 'no-store', signal: AbortSignal.timeout(action === 'studio' || action === 'free' ? 125000 : 25000),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new ApiError(data.error || data.message || `Santa’s service returned ${response.status}. Please retry.`, response.status, data.availableAt);
  }
  return response;
}
