"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type { User } from "@/api/generated";
import { api } from "@/api/client";

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (token: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
    return {
      user: null,
      token,
      isLoading: Boolean(token),
    };
  });

  const fetchUser = useCallback(async () => {
    try {
      const user = await api.readUsersMeApiAuthMeGet();
      setState((prev) => ({ ...prev, user, isLoading: false }));
    } catch {
      localStorage.removeItem("access_token");
      setState({ user: null, token: null, isLoading: false });
    }
  }, []);

  useEffect(() => {
    if (state.token) {
      void Promise.resolve().then(fetchUser);
    }
  }, [fetchUser, state.token]);

  const login = useCallback(
    async (token: string) => {
      localStorage.setItem("access_token", token);
      setState((prev) => ({ ...prev, token }));
      await fetchUser();
    },
    [fetchUser],
  );

  const logout = useCallback(() => {
    localStorage.removeItem("access_token");
    setState({ user: null, token: null, isLoading: false });
  }, []);

  return (
    <AuthContext.Provider
      value={{ ...state, login, logout, refreshUser: fetchUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
