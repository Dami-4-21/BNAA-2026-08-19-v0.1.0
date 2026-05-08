"use client";

import type { SafeUser } from "@/lib/auth";
import { apiFetch } from "@/lib/api";

export type AuthSessionPayload = {
  user: SafeUser | null;
};

export type AuthLoginPayload = {
  user: SafeUser;
};

export type SignInInput = {
  email: string;
  password: string;
};

export const authSessionQueryKey = ["auth", "session"] as const;

export function fetchAuthSession() {
  return apiFetch<AuthSessionPayload>("/api/auth/session", {
    method: "GET",
  });
}

export function signInRequest(input: SignInInput) {
  return apiFetch<AuthLoginPayload>("/api/auth/login", {
    method: "POST",
    body: input,
  });
}

export function signOutRequest() {
  return apiFetch<{ ok: true }>("/api/auth/session", {
    method: "DELETE",
  });
}
