import { randomBytes } from "node:crypto";

export const sessionCookieName = "bnaasaas_session";
export const sessionLifetimeSeconds = 60 * 60 * 24 * 7;
const useSecureCookies = process.env.BNAASAAS_SECURE_COOKIE === "true";

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
    secure: useSecureCookies,
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
