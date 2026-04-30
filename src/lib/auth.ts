export type UserRole =
  | "Comptable"
  | "Chef de projet"
  | "Conductrice travaux"
  | "Bureau d'etudes"
  | "Maitre d'ouvrage"
  | "Super Admin";

export type AppPermission =
  | "dashboard.view"
  | "documentation.view"
  | "projects.view"
  | "site.view"
  | "site.report.create"
  | "site.photo.create"
  | "site.ncr.create"
  | "site.ncr.close"
  | "documents.view"
  | "documents.version.publish"
  | "documents.distribute"
  | "documents.obsolete.mark"
  | "finance.view"
  | "finance.invoice.create"
  | "finance.invoice.send"
  | "finance.invoice.validate"
  | "finance.payment.record"
  | "notifications.view"
  | "admin.view"
  | "admin.manage";

export type AppUser = {
  id: string;
  name: string;
  email: string;
  password: string;
  role: UserRole;
  initials: string;
  projectIds: string[];
};

export type SafeUser = Omit<AppUser, "password">;

export const sessionStorageKey = "bnaasaas-session-user-id";

const allPermissions: AppPermission[] = [
  "dashboard.view",
  "documentation.view",
  "projects.view",
  "site.view",
  "site.report.create",
  "site.photo.create",
  "site.ncr.create",
  "site.ncr.close",
  "documents.view",
  "documents.version.publish",
  "documents.distribute",
  "documents.obsolete.mark",
  "finance.view",
  "finance.invoice.create",
  "finance.invoice.send",
  "finance.invoice.validate",
  "finance.payment.record",
  "notifications.view",
  "admin.view",
  "admin.manage",
];

const basePermissions: AppPermission[] = [
  "dashboard.view",
  "documentation.view",
  "projects.view",
  "notifications.view",
];

export const appUsers: AppUser[] = [
  {
    id: "USR-001",
    name: "Sara Ben Salah",
    email: "sara@bnaasaas.tn",
    password: "bnaasaas2026",
    role: "Comptable",
    initials: "SB",
    projectIds: ["BN-042", "BN-039", "BN-031"],
  },
  {
    id: "USR-002",
    name: "Amine Gharbi",
    email: "amine@bnaasaas.tn",
    password: "bnaasaas2026",
    role: "Chef de projet",
    initials: "AG",
    projectIds: ["BN-042", "BN-039", "BN-031"],
  },
  {
    id: "USR-003",
    name: "Nour Baccar",
    email: "nour@bnaasaas.tn",
    password: "bnaasaas2026",
    role: "Conductrice travaux",
    initials: "NB",
    projectIds: ["BN-042"],
  },
  {
    id: "USR-004",
    name: "Hichem Trabelsi",
    email: "hichem@bnaasaas.tn",
    password: "bnaasaas2026",
    role: "Bureau d'etudes",
    initials: "HT",
    projectIds: ["BN-042", "BN-039"],
  },
  {
    id: "USR-005",
    name: "Salma Ben Salem",
    email: "salma@bnaasaas.tn",
    password: "bnaasaas2026",
    role: "Maitre d'ouvrage",
    initials: "SS",
    projectIds: ["BN-042", "BN-039", "BN-031"],
  },
  {
    id: "USR-006",
    name: "Adel Mansouri",
    email: "adel@bnaasaas.tn",
    password: "bnaasaas2026",
    role: "Super Admin",
    initials: "AM",
    projectIds: ["*"],
  },
];

const rolePermissions: Record<UserRole, AppPermission[]> = {
  Comptable: [
    ...basePermissions,
    "site.view",
    "documents.view",
    "finance.view",
    "finance.invoice.create",
    "finance.invoice.send",
    "finance.payment.record",
  ],
  "Chef de projet": [
    ...basePermissions,
    "site.view",
    "site.report.create",
    "site.photo.create",
    "site.ncr.create",
    "site.ncr.close",
    "documents.view",
    "documents.distribute",
    "finance.view",
    "finance.invoice.create",
    "finance.invoice.send",
    "admin.view",
  ],
  "Conductrice travaux": [
    ...basePermissions,
    "site.view",
    "site.report.create",
    "site.photo.create",
    "site.ncr.create",
    "site.ncr.close",
    "documents.view",
  ],
  "Bureau d'etudes": [
    ...basePermissions,
    "site.view",
    "documents.view",
    "documents.version.publish",
    "documents.distribute",
    "documents.obsolete.mark",
  ],
  "Maitre d'ouvrage": [
    ...basePermissions,
    "site.view",
    "documents.view",
    "finance.view",
    "finance.invoice.validate",
  ],
  "Super Admin": allPermissions,
};

const routePermissions: Array<{ prefix: string; permission: AppPermission }> = [
  { prefix: "/admin", permission: "admin.view" },
  { prefix: "/finance", permission: "finance.view" },
  { prefix: "/documents", permission: "documents.view" },
  { prefix: "/documentation", permission: "documentation.view" },
  { prefix: "/site", permission: "site.view" },
  { prefix: "/projects", permission: "projects.view" },
  { prefix: "/notifications", permission: "notifications.view" },
  { prefix: "/", permission: "dashboard.view" },
];

export function findUserByCredentials(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();

  return (
    appUsers.find(
      (user) =>
        user.email.toLowerCase() === normalizedEmail && user.password === password,
    ) ?? null
  );
}

export function getUserById(userId: string | null | undefined) {
  if (!userId) {
    return null;
  }

  return appUsers.find((user) => user.id === userId) ?? null;
}

export function sanitizeUser(user: AppUser): SafeUser {
  const { password, ...safeUser } = user;
  void password;
  return safeUser;
}

export function getPermissionsForRole(role: UserRole) {
  return rolePermissions[role] ?? basePermissions;
}

export function hasPermission(
  user: Pick<AppUser, "role"> | null | undefined,
  permission: AppPermission,
) {
  if (!user) {
    return false;
  }

  return getPermissionsForRole(user.role).includes(permission);
}

export function canAccessProject(
  user: Pick<AppUser, "projectIds"> | null | undefined,
  projectId: string,
) {
  if (!user) {
    return false;
  }

  return user.projectIds.includes("*") || user.projectIds.includes(projectId);
}

export function getHomePathForRole(role: UserRole) {
  switch (role) {
    case "Comptable":
      return "/finance";
    case "Conductrice travaux":
      return "/site";
    case "Bureau d'etudes":
      return "/documents";
    default:
      return "/";
  }
}

export function getRequiredPermissionForPath(pathname: string) {
  return (
    routePermissions.find((route) =>
      route.prefix === "/"
        ? pathname === "/"
        : pathname === route.prefix || pathname.startsWith(`${route.prefix}/`),
    )?.permission ?? "dashboard.view"
  );
}
