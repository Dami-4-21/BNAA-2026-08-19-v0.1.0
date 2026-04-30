"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  getHomePathForRole,
  getPermissionsForRole,
  hasPermission,
  type AppPermission,
  type SafeUser,
} from "@/lib/auth";
import { apiFetch } from "@/lib/api";

type SignInInput = {
  email: string;
  password: string;
};

type SignInResult =
  | { ok: true; user: SafeUser }
  | { ok: false; error: string };

type AuthContextValue = {
  currentUser: SafeUser | null;
  isAuthenticated: boolean;
  isReady: boolean;
  permissions: AppPermission[];
  homePath: string;
  can: (permission: AppPermission) => boolean;
  signIn: (input: SignInInput) => Promise<SignInResult>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [currentUser, setCurrentUser] = useState<SafeUser | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadSession() {
      try {
        const session = await apiFetch<{
          user: SafeUser | null;
        }>("/api/auth/session", {
          method: "GET",
        });

        if (!cancelled) {
          setCurrentUser(session.user);
        }
      } catch {
        if (!cancelled) {
          setCurrentUser(null);
        }
      } finally {
        if (!cancelled) {
          setIsReady(true);
        }
      }
    }

    void loadSession();

    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async ({ email, password }: SignInInput): Promise<SignInResult> => {
    try {
      const payload = await apiFetch<{
        user: SafeUser;
      }>("/api/auth/login", {
        method: "POST",
        body: { email, password },
      });

      setCurrentUser(payload.user);

      return {
        ok: true,
        user: payload.user,
      };
    } catch (error) {
      return {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Identifiants invalides. Verifiez votre email et votre mot de passe.",
      };
    }
  }, []);

  const signOut = useCallback(async () => {
    await apiFetch<{ ok: true }>("/api/auth/session", {
      method: "DELETE",
    });
    setCurrentUser(null);
  }, []);

  const permissions = useMemo(
    () => (currentUser ? getPermissionsForRole(currentUser.role) : []),
    [currentUser],
  );

  const can = useCallback(
    (permission: AppPermission) => hasPermission(currentUser, permission),
    [currentUser],
  );

  const value = useMemo(
    () => ({
      currentUser,
      isAuthenticated: Boolean(currentUser),
      isReady,
      permissions,
      homePath: currentUser ? getHomePathForRole(currentUser.role) : "/login",
      can,
      signIn,
      signOut,
    }),
    [can, currentUser, isReady, permissions, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}
