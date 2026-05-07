import {
  appUsers,
  getHomePathForRole,
  getPermissionsForRole,
  sanitizeUser,
  type SafeUser,
  type UserRole,
} from "@/lib/auth";

export const rebuildAccessCookieName = "bnaasaas_api_access";

type RebuildBackendRole = "ADMIN" | "BE" | "CO" | "CP" | "CT" | "MO";

type RebuildAuthMeResponse = {
  tenant: {
    id: string;
    name: string;
    slug: string;
    plan: string;
  };
  user: {
    id: string;
    email: string;
    fullName: string;
    role: RebuildBackendRole;
    tenantId: string;
    isActive: boolean;
    totpEnabled: boolean;
  };
};

export function shouldUseRebuildAuthBridge() {
  return process.env.BNAASAAS_REBUILD_AUTH_ENABLED === "true";
}

export function getRebuildApiUrl() {
  return process.env.BNAASAAS_REBUILD_API_URL?.replace(/\/+$/, "") ?? "";
}

export async function fetchRebuildSession(
  accessToken: string,
): Promise<{
  homePath: string;
  permissions: ReturnType<typeof getPermissionsForRole>;
  tenant: RebuildAuthMeResponse["tenant"];
  user: SafeUser;
} | null> {
  const apiUrl = getRebuildApiUrl();

  if (!apiUrl || !accessToken) {
    return null;
  }

  const response = await fetch(`${apiUrl}/api/v1/auth/me`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as RebuildAuthMeResponse;
  const user = mapRebuildUserToSafeUser(payload.user);

  return {
    user,
    tenant: payload.tenant,
    homePath: getHomePathForRole(user.role),
    permissions: getPermissionsForRole(user.role),
  };
}

function mapRebuildUserToSafeUser(user: RebuildAuthMeResponse["user"]): SafeUser {
  const legacyUser =
    appUsers.find((entry) => entry.email.toLowerCase() === user.email.toLowerCase()) ?? null;

  if (legacyUser) {
    return {
      ...sanitizeUser(legacyUser),
      email: user.email,
      id: legacyUser.id,
      initials: buildInitials(user.fullName),
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
