import { NextResponse } from "next/server";

import {
  appUsers,
  getHomePathForRole,
  getPermissionsForRole,
  sanitizeUser,
  type SafeUser,
  type UserRole,
} from "@/lib/auth";
import type { WorkspaceProject } from "@/lib/backend/types";

export const rebuildAccessCookieName = "bnaasaas_api_access";
export const rebuildRefreshCookieName = "bnaasaas_api_refresh";

const rebuildAccessLifetimeSeconds = 15 * 60;
const rebuildRefreshLifetimeSeconds = 30 * 24 * 60 * 60;
const useSecureCookies = process.env.BNAASAAS_SECURE_COOKIE === "true";

type RebuildBackendRole = "ADMIN" | "BE" | "CO" | "CP" | "CT" | "MO";

type RebuildTenant = {
  id: string;
  name: string;
  slug: string;
  plan: string;
  isActive?: boolean;
  createdAt?: string;
};

type RebuildUser = {
  id: string;
  email: string;
  fullName: string;
  role: RebuildBackendRole;
  tenantId: string;
  isActive: boolean;
  totpEnabled: boolean;
};

type RebuildAuthMeResponse = {
  tenant: RebuildTenant;
  user: RebuildUser;
};

type RebuildAuthSessionResponse = RebuildAuthMeResponse & {
  accessToken: string;
  requires2fa?: boolean;
  tempToken?: string;
};

export type RebuildAppSession = {
  homePath: string;
  permissions: ReturnType<typeof getPermissionsForRole>;
  tenant: RebuildTenant;
  user: SafeUser;
};

type RebuildBridgeTokens = {
  accessToken: string;
  refreshToken: string;
};

type RebuildBridgeSession = {
  session: RebuildAppSession;
  tokens: RebuildBridgeTokens;
};

type RebuildProject = {
  city: string | null;
  createdAt: string;
  endDate: string | null;
  governorate: string | null;
  id: string;
  name: string;
  startDate: string | null;
  status: string;
  type: string | null;
};

type RebuildProjectListResponse = {
  items: RebuildProject[];
};

type RebuildProjectMembersResponse = {
  items: Array<{
    addedAt: string;
    email: string;
    fullName: string;
    isActive: boolean;
    role: string;
    userId: string;
  }>;
};

export function shouldUseRebuildAuthBridge() {
  return process.env.BNAASAAS_REBUILD_AUTH_ENABLED === "true";
}

export function shouldUseRebuildProjectsBridge() {
  return process.env.BNAASAAS_REBUILD_PROJECTS_ENABLED === "true";
}

export function getRebuildApiUrl() {
  return process.env.BNAASAAS_REBUILD_API_URL?.replace(/\/+$/, "") ?? "";
}

export function applyRebuildSessionCookies(
  response: NextResponse,
  tokens: RebuildBridgeTokens,
) {
  response.cookies.set(buildRebuildCookie(rebuildAccessCookieName, tokens.accessToken, {
    maxAge: rebuildAccessLifetimeSeconds,
  }));
  response.cookies.set(buildRebuildCookie(rebuildRefreshCookieName, tokens.refreshToken, {
    maxAge: rebuildRefreshLifetimeSeconds,
  }));
}

export function clearRebuildSessionCookies(response: NextResponse) {
  response.cookies.set(buildExpiredRebuildCookie(rebuildAccessCookieName));
  response.cookies.set(buildExpiredRebuildCookie(rebuildRefreshCookieName));
}

export async function authenticateWithRebuildApi(
  email: string,
  password: string,
): Promise<RebuildBridgeSession | null> {
  const apiUrl = getRebuildApiUrl();

  if (!apiUrl) {
    return null;
  }

  try {
    const response = await fetch(`${apiUrl}/api/v1/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        password,
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as RebuildAuthSessionResponse;
    if (payload.requires2fa || !payload.accessToken) {
      return null;
    }

    const refreshToken = extractCookieFromResponse(response, "refreshToken");
    if (!refreshToken) {
      return null;
    }

    return {
      session: mapAuthPayloadToSession(payload),
      tokens: {
        accessToken: payload.accessToken,
        refreshToken,
      },
    };
  } catch {
    return null;
  }
}

export async function fetchRebuildSession(
  accessToken: string,
): Promise<RebuildAppSession | null> {
  const payload = await fetchRebuildJson<RebuildAuthMeResponse>("/api/v1/auth/me", accessToken);
  return payload ? mapSessionPayload(payload) : null;
}

export async function refreshRebuildSession(
  refreshToken: string,
): Promise<RebuildBridgeSession | null> {
  const apiUrl = getRebuildApiUrl();

  if (!apiUrl || !refreshToken) {
    return null;
  }

  try {
    const response = await fetch(`${apiUrl}/api/v1/auth/refresh`, {
      method: "POST",
      headers: {
        Cookie: `refreshToken=${encodeURIComponent(refreshToken)}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as RebuildAuthSessionResponse;
    const nextRefreshToken = extractCookieFromResponse(response, "refreshToken");
    if (!payload.accessToken || !nextRefreshToken) {
      return null;
    }

    return {
      session: mapAuthPayloadToSession(payload),
      tokens: {
        accessToken: payload.accessToken,
        refreshToken: nextRefreshToken,
      },
    };
  } catch {
    return null;
  }
}

export async function logoutFromRebuildApi(accessToken: string) {
  await fetchRebuildJson("/api/v1/auth/logout", accessToken, {
    method: "POST",
  });
}

export async function fetchRebuildProjects(accessToken: string) {
  const payload = await fetchRebuildJson<RebuildProjectListResponse>(
    "/api/v1/projects",
    accessToken,
  );

  return payload?.items ?? null;
}

export async function fetchRebuildProjectMembers(
  accessToken: string,
  projectId: string,
) {
  const payload = await fetchRebuildJson<RebuildProjectMembersResponse>(
    `/api/v1/projects/${projectId}/members`,
    accessToken,
  );

  return payload?.items ?? null;
}

export function mapRebuildProjectsToLegacyWorkspaceProjects(
  rebuildProjects: RebuildProject[],
  projectCatalog: WorkspaceProject[],
) {
  const catalogByName = new Map(
    projectCatalog.map((project) => [buildProjectCompatibilityKey(project.name), project]),
  );

  return rebuildProjects
    .map((project) => catalogByName.get(buildProjectCompatibilityKey(project.name)) ?? null)
    .filter((project): project is WorkspaceProject => project !== null);
}

function mapAuthPayloadToSession(
  payload: RebuildAuthMeResponse | RebuildAuthSessionResponse,
): RebuildAppSession {
  return mapSessionPayload({
    tenant: payload.tenant,
    user: payload.user,
  });
}

function mapSessionPayload(payload: RebuildAuthMeResponse): RebuildAppSession {
  const user = mapRebuildUserToSafeUser(payload.user);

  return {
    user,
    tenant: payload.tenant,
    homePath: getHomePathForRole(user.role),
    permissions: getPermissionsForRole(user.role),
  };
}

function mapRebuildUserToSafeUser(user: RebuildUser): SafeUser {
  const legacyUser =
    appUsers.find((entry) => entry.email.toLowerCase() === user.email.toLowerCase()) ?? null;

  if (legacyUser) {
    return {
      ...sanitizeUser(legacyUser),
      email: user.email,
      id: legacyUser.id,
      initials: legacyUser.initials,
      name: user.fullName,
      role: mapBackendRoleToLegacyRole(user.role),
    };
  }

  return {
    email: user.email,
    id: `api-${user.id}`,
    initials: buildInitials(user.fullName),
    name: user.fullName,
    projectIds: [],
    role: mapBackendRoleToLegacyRole(user.role),
  };
}

function mapBackendRoleToLegacyRole(role: RebuildBackendRole): UserRole {
  switch (role) {
    case "ADMIN":
      return "Super Admin";
    case "BE":
      return "Bureau d'etudes";
    case "CO":
      return "Comptable";
    case "CP":
      return "Chef de projet";
    case "CT":
      return "Conductrice travaux";
    case "MO":
    default:
      return "Maitre d'ouvrage";
  }
}

function buildInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part.trim()[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function buildProjectCompatibilityKey(value: string) {
  return value.trim().toLowerCase();
}

async function fetchRebuildJson<T>(
  path: string,
  accessToken: string,
  options?: RequestInit,
): Promise<T | null> {
  const apiUrl = getRebuildApiUrl();

  if (!apiUrl || !accessToken) {
    return null;
  }

  try {
    const response = await fetch(`${apiUrl}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(options?.headers ?? {}),
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    if (response.status === 204) {
      return null;
    }

    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function buildRebuildCookie(name: string, value: string, options: { maxAge: number }) {
  return {
    name,
    value,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: useSecureCookies,
    path: "/",
    maxAge: options.maxAge,
  };
}

function buildExpiredRebuildCookie(name: string) {
  return {
    ...buildRebuildCookie(name, "", {
      maxAge: 0,
    }),
    expires: new Date(0),
  };
}

function extractCookieFromResponse(response: Response, name: string) {
  const setCookieHeaders = getSetCookieHeaders(response);

  for (const headerValue of setCookieHeaders) {
    const match = new RegExp(`${name}=([^;]+)`).exec(headerValue);
    if (match?.[1]) {
      return decodeURIComponent(match[1]);
    }
  }

  return null;
}

function getSetCookieHeaders(response: Response) {
  const headers = response.headers as Headers & {
    getSetCookie?: () => string[];
  };

  if (typeof headers.getSetCookie === "function") {
    return headers.getSetCookie();
  }

  const setCookie = response.headers.get("set-cookie");
  return setCookie ? [setCookie] : [];
}
