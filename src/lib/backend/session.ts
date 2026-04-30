import { randomBytes } from "node:crypto";

export const sessionCookieName = "bnaasaas_session";
export const sessionLifetimeSeconds = 60 * 60 * 24 * 7;

export function createSessionToken() {
  return randomBytes(24).toString("hex");
}

export function createSessionExpiry() {
  return new Date(Date.now() + sessionLifetimeSeconds * 1000).toISOString();
}

export function buildSessionCookie(value: string) {
  return {
    name: sessionCookieName,
    value,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: sessionLifetimeSeconds,
  };
}

export function buildExpiredSessionCookie() {
  return {
    ...buildSessionCookie(""),
    maxAge: 0,
  };
}
