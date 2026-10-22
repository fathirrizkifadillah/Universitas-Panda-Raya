import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User, Device } from '../types.ts';
import {
  apiFetch,
  setAccessToken,
  setDeviceId,
  getDeviceId,
  setOnSessionExpired,
} from '../api/client.ts';

interface AuthContextType {
  user: User | null;
  device: Device | null;
  deviceId: string;
  isLoading: boolean;
  login: (username: string, password: string, deviceId: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [device, setDevice] = useState<Device | null>(null);
  const [deviceIdState, setDeviceIdState] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchProfile = async () => {
    const res = await apiFetch<{ user: User; devices: Device[] }>('/me');
    if (res.success && res.data) {
      setUser(res.data.user);
      const matchedDevice = res.data.devices.find((d) => d.device_id === getDeviceId());
      if (matchedDevice) {
        setDevice(matchedDevice);
      }
    } else {
      setUser(null);
      setDevice(null);
    }
  };

  useEffect(() => {
    setOnSessionExpired(() => {
      setUser(null);
      setDevice(null);
    });

    // Check if previous session can be restored via HttpOnly refresh cookie
    const initSession = async () => {
      setIsLoading(true);
      // Try refresh
      const refreshRes = await apiFetch<{ accessToken: string }>('/auth/refresh', {
        method: 'POST',
      });

      if (refreshRes.success && refreshRes.data?.accessToken) {
        setAccessToken(refreshRes.data.accessToken);
        await fetchProfile();
      }
      setIsLoading(false);
    };

    initSession();
  }, []);

  const login = async (username: string, password: string, deviceIdInput: string) => {
    setDeviceId(deviceIdInput);
    setDeviceIdState(deviceIdInput);

    const res = await apiFetch<{ accessToken: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
      headers: {
        'X-Device-ID': deviceIdInput,
      },
    });

    if (res.success && res.data) {
      setAccessToken(res.data.accessToken);
      setUser(res.data.user);
      await fetchProfile();
      return { success: true };
    }

    return {
      success: false,
      message: res.message || 'Login gagal. Periksa kembali kredensial dan perangkat Anda.',
    };
  };

  const logout = async () => {
    await apiFetch('/auth/logout', { method: 'POST' });
    setAccessToken(null);
    setUser(null);
    setDevice(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        device,
        deviceId: deviceIdState,
        isLoading,
        login,
        logout,
        refreshProfile: fetchProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
