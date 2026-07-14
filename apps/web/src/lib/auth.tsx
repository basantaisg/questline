'use client';

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { api, post, setAccessToken, tryRefresh } from './api';
import { Me, PendingVerification, User } from './types';

interface AuthContextValue {
  me: Me | null;
  loading: boolean;
  /** Creates the account and mails a code. Returns no session — the caller
   *  must send the user to /verify. */
  signup: (
    email: string,
    username: string,
    password: string,
  ) => Promise<PendingVerification>;
  signin: (email: string, password: string) => Promise<void>;
  /** Confirms the emailed code and signs the user in. */
  verifyOtp: (email: string, code: string) => Promise<void>;
  resendOtp: (email: string) => Promise<{ message: string }>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshMe = useCallback(async () => {
    const data = await api<Me>('/users/me');
    setMe(data);
  }, []);

  // On first load, try to resume the session from the refresh cookie.
  useEffect(() => {
    (async () => {
      const ok = await tryRefresh();
      if (ok) {
        try {
          await refreshMe();
        } catch {
          setMe(null);
        }
      }
      setLoading(false);
    })();
  }, [refreshMe]);

  const signin = useCallback(
    async (email: string, password: string) => {
      const result = await post<{ user: User; accessToken: string }>('/auth/signin', {
        email,
        password,
      });
      setAccessToken(result.accessToken);
      await refreshMe();
    },
    [refreshMe],
  );

  const signup = useCallback(
    (email: string, username: string, password: string) =>
      post<PendingVerification>('/auth/signup', { email, username, password }),
    [],
  );

  const verifyOtp = useCallback(
    async (email: string, code: string) => {
      const result = await post<{ user: User; accessToken: string }>('/auth/verify-otp', {
        email,
        code,
      });
      setAccessToken(result.accessToken);
      await refreshMe();
    },
    [refreshMe],
  );

  const resendOtp = useCallback(
    (email: string) => post<{ message: string }>('/auth/resend-otp', { email }),
    [],
  );

  const logout = useCallback(async () => {
    try {
      await post('/auth/logout');
    } finally {
      setAccessToken(null);
      setMe(null);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{ me, loading, signup, signin, verifyOtp, resendOtp, logout, refreshMe }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
