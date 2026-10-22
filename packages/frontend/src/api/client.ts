import type { User, Device } from '../types.ts';

const GATEWAY_URL = 'http://localhost:3000';

let inMemoryAccessToken: string | null = null;
let currentDeviceId: string = '';
let onSessionExpiredCallback: (() => void) | null = null;
let isRefreshing = false;
let refreshSubscribers: Array<(token: string) => void> = [];

export function setAccessToken(token: string | null) {
  inMemoryAccessToken = token;
}

export function getAccessToken(): string | null {
  return inMemoryAccessToken;
}

export function setDeviceId(deviceId: string) {
  currentDeviceId = deviceId;
}

export function getDeviceId(): string {
  return currentDeviceId;
}

export function setOnSessionExpired(cb: () => void) {
  onSessionExpiredCallback = cb;
}

function onRefreshed(token: string) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<{ success: boolean; data?: T; error?: string; message?: string; status: number }> {
  const url = `${GATEWAY_URL}${path}`;
  const headers = new Headers(options.headers || {});

  headers.set('Content-Type', 'application/json');

  if (inMemoryAccessToken) {
    headers.set('Authorization', `Bearer ${inMemoryAccessToken}`);
  }

  if (currentDeviceId) {
    headers.set('X-Device-ID', currentDeviceId);
  }

  try {
    const res = await fetch(url, {
      ...options,
      headers,
      credentials: 'include', // sends HttpOnly refresh cookie
    });

    // Handle 401 Token Expiry & Automatic Refresh (Once)
    if (res.status === 401 && inMemoryAccessToken && !path.startsWith('/auth/')) {
      if (!isRefreshing) {
        isRefreshing = true;
        try {
          const refreshRes = await fetch(`${GATEWAY_URL}/auth/refresh`, {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              'X-Device-ID': currentDeviceId,
            },
          });

          if (refreshRes.ok) {
            const refreshData = await refreshRes.json();
            const newToken = refreshData.data.accessToken;
            setAccessToken(newToken);
            isRefreshing = false;
            onRefreshed(newToken);

            // Retry original request with new token
            headers.set('Authorization', `Bearer ${newToken}`);
            const retryRes = await fetch(url, {
              ...options,
              headers,
              credentials: 'include',
            });
            const data = await retryRes.json();
            return {
              success: retryRes.ok,
              status: retryRes.status,
              ...data,
            };
          } else {
            // Refresh failed: session dead
            isRefreshing = false;
            setAccessToken(null);
            if (onSessionExpiredCallback) onSessionExpiredCallback();
            return {
              success: false,
              status: 401,
              error: 'SESSION_EXPIRED',
              message: 'Sesi Anda telah berakhir. Silakan login kembali.',
            };
          }
        } catch (err: any) {
          isRefreshing = false;
          setAccessToken(null);
          if (onSessionExpiredCallback) onSessionExpiredCallback();
          return {
            success: false,
            status: 401,
            error: 'REFRESH_FAILED',
            message: 'Gagal memperbarui sesi.',
          };
        }
      } else {
        // Wait for active refresh to finish
        return new Promise((resolve) => {
          refreshSubscribers.push(async (newToken) => {
            headers.set('Authorization', `Bearer ${newToken}`);
            const retryRes = await fetch(url, {
              ...options,
              headers,
              credentials: 'include',
            });
            const data = await retryRes.json();
            resolve({
              success: retryRes.ok,
              status: retryRes.status,
              ...data,
            });
          });
        });
      }
    }

    const json = await res.json().catch(() => ({}));
    return {
      success: res.ok,
      status: res.status,
      ...json,
    };
  } catch (netErr: any) {
    return {
      success: false,
      status: 503,
      error: 'NETWORK_ERROR',
      message: 'Tidak dapat terhubung ke API Gateway (Port 3000). Pastikan Gateway sedang berjalan.',
    };
  }
}
