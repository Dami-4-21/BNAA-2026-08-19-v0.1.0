"use client";

import {
  type PropsWithChildren,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  getHomePathForRole,
  getPermissionsForRole,
  hasPermission,
  type AppPermission,
  type SafeUser,
} from "@/lib/auth";
import {
  authSessionQueryKey,
  fetchAuthSession,
  signInRequest,
  signOutRequest,
  type SignInInput,
} from "@/lib/queries/auth";
import { useAppStore } from "@/store/app-store";

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

export function AuthProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const currentUser = useAppStore((state) => state.currentUser);
  const isReady = useAppStore((state) => state.isAuthReady);
  const setCurrentUser = useAppStore((state) => state.setCurrentUser);
  const setAuthReady = useAppStore((state) => state.setAuthReady);
  const resetAuthState = useAppStore((state) => state.resetAuthState);

  const sessionQuery = useQuery({
    queryKey: authSessionQueryKey,
    queryFn: fetchAuthSession,
    staleTime: 60_000,
  });

  const signInMutation = useMutation({
    mutationFn: signInRequest,
    onSuccess: (payload) => {
      queryClient.setQueryData(authSessionQueryKey, { user: payload.user });
      setCurrentUser(payload.user);
      setAuthReady(true);
    },
  });

  const signOutMutation = useMutation({
    mutationFn: signOutRequest,
    onSuccess: () => {
      queryClient.setQueryData(authSessionQueryKey, { user: null });
      queryClient.removeQueries({
        queryKey: ["workspace"],
      });
      setCurrentUser(null);
      setAuthReady(true);
    },
  });

  useEffect(() => {
    if (sessionQuery.status === "pending") {
      return;
    }

    setCurrentUser(sessionQuery.data?.user ?? null);
    setAuthReady(true);
  }, [sessionQuery.data, sessionQuery.status, setAuthReady, setCurrentUser]);

  const signIn = useCallback(async (input: SignInInput): Promise<SignInResult> => {
    try {
      const payload = await signInMutation.mutateAsync(input);

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
  }, [signInMutation]);

  const signOut = useCallback(async () => {
    try {
      await signOutMutation.mutateAsync();
    } catch {
      queryClient.setQueryData(authSessionQueryKey, { user: null });
      queryClient.removeQueries({
        queryKey: ["workspace"],
      });
      resetAuthState();
    }
  }, [queryClient, resetAuthState, signOutMutation]);

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
