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
  findUserByCredentials,
  getHomePathForRole,
  getPermissionsForRole,
  getUserById,
  hasPermission,
  sessionStorageKey,
  type AppPermission,
  type AppUser,
} from "@/lib/auth";

type SignInInput = {
  email: string;
  password: string;
};

type SignInResult =
  | { ok: true; user: AppUser }
  | { ok: false; error: string };

type AuthContextValue = {
  currentUser: AppUser | null;
  isAuthenticated: boolean;
  isReady: boolean;
  permissions: AppPermission[];
  homePath: string;
  can: (permission: AppPermission) => boolean;
  signIn: (input: SignInInput) => SignInResult;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      const sessionUserId = window.localStorage.getItem(sessionStorageKey);
      setCurrentUser(getUserById(sessionUserId));
      setIsReady(true);
    });
  }, []);

  const signIn = useCallback(({ email, password }: SignInInput): SignInResult => {
    const user = findUserByCredentials(email, password);

    if (!user) {
      return {
        ok: false,
        error: "Identifiants invalides. Verifiez votre email et votre mot de passe.",
      };
    }

    window.localStorage.setItem(sessionStorageKey, user.id);
    setCurrentUser(user);

    return { ok: true, user };
  }, []);

  const signOut = useCallback(() => {
    window.localStorage.removeItem(sessionStorageKey);
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
