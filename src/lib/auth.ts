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
  | "site.report.validate"
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

const allPermissions: AppPermission[] = [
  "dashboard.view",
  "documentation.view",
  "projects.view",
  "site.view",
  "site.report.create",
  "site.report.validate",
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
    "site.report.validate",
    "site.photo.create",
    "site.ncr.create",
    "site.ncr.close",
    "documents.view",
    "documents.distribute",
    "finance.view",
    "finance.invoice.create",
    "finance.invoice.send",
    "finance.invoice.validate",
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
    "site.report.validate",
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
  { prefix: "/dashboard", permission: "dashboard.view" },
  { prefix: "/finance", permission: "finance.view" },
  { prefix: "/documents", permission: "documents.view" },
  { prefix: "/documentation", permission: "documentation.view" },
  { prefix: "/site", permission: "site.view" },
  { prefix: "/projects", permission: "projects.view" },
  { prefix: "/notifications", permission: "notifications.view" },
];

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
    case "Super Admin":
      return "/admin";
    case "Comptable":
      return "/finance";
    case "Conductrice travaux":
      return "/site";
    case "Bureau d'etudes":
      return "/documents";
    default:
      return "/dashboard";
  }
}

export function getRequiredPermissionForPath(pathname: string) {
  return (
    routePermissions.find(
      (route) => pathname === route.prefix || pathname.startsWith(`${route.prefix}/`),
    )?.permission ?? "dashboard.view"
  );
}
