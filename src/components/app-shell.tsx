"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Bell,
  ChevronRight,
  CircleDollarSign,
  BookOpenText,
  FileStack,
  FolderKanban,
  LayoutDashboard,
  type LucideIcon,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  ShieldCheck,
  SquarePen,
} from "lucide-react";

import { useAuth } from "@/components/auth-context";
import { type AppPermission } from "@/lib/auth";
import { cx } from "@/components/ui";
import { useWorkspace } from "@/components/workspace-context";

type NavItem = {
  href: string;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  permission: AppPermission;
};

const navItems: NavItem[] = [
  {
    href: "/",
    label: "Tableau de bord",
    shortLabel: "Accueil",
    icon: LayoutDashboard,
    permission: "dashboard.view",
  },
  {
    href: "/projects",
    label: "Projets",
    shortLabel: "Projets",
    icon: FolderKanban,
    permission: "projects.view",
  },
  {
    href: "/documentation",
    label: "Documentation",
    shortLabel: "Docs",
    icon: BookOpenText,
    permission: "documentation.view",
  },
  {
    href: "/site",
    label: "Suivi chantier",
    shortLabel: "Site",
    icon: SquarePen,
    permission: "site.view",
  },
  {
    href: "/documents",
    label: "GED & Plans",
    shortLabel: "Docs",
    icon: FileStack,
    permission: "documents.view",
  },
  {
    href: "/finance",
    label: "Finance",
    shortLabel: "Finance",
    icon: CircleDollarSign,
    permission: "finance.view",
  },
  {
    href: "/notifications",
    label: "Notifications",
    shortLabel: "Alertes",
    icon: Bell,
    permission: "notifications.view",
  },
  {
    href: "/admin",
    label: "Admin",
    shortLabel: "Admin",
    icon: ShieldCheck,
    permission: "admin.view",
  },
];

function isActive(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname.startsWith(href);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { signOut } = useAuth();
  const { activeProject, availableProjects, can, currentUser, setActiveProjectId, tenant } =
    useWorkspace();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return window.localStorage.getItem("bnaasaas-sidebar-collapsed") === "true";
  });
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    window.localStorage.setItem(
      "bnaasaas-sidebar-collapsed",
      String(sidebarCollapsed),
    );
  }, [sidebarCollapsed]);

  const visibleNavItems = navItems.filter((item) => can(item.permission));

  const currentNav =
    visibleNavItems.find((item) => item.href !== "/" && pathname.startsWith(item.href)) ??
    visibleNavItems.find((item) => item.href === pathname) ??
    visibleNavItems[0] ??
    navItems[0];

  async function handleSignOut() {
    await signOut();
    router.replace("/login");
  }

  return (
    <div className="workspace-light min-h-screen">
      <div className="pointer-events-none fixed inset-0 data-grid opacity-30" />

      <div
        className={cx(
          "relative mx-auto max-w-[1600px] lg:grid lg:transition-[grid-template-columns]",
          sidebarCollapsed
            ? "lg:grid-cols-[118px_minmax(0,1fr)]"
            : "lg:grid-cols-[280px_minmax(0,1fr)]",
        )}
      >
        <aside
          className={cx(
            "hidden h-screen flex-col overflow-visible border-r border-stone-200 bg-white py-6 lg:sticky lg:top-0 lg:flex lg:transition-[padding,width]",
            sidebarCollapsed ? "items-center px-3" : "px-4",
          )}
        >
          <div
            className={cx(
              "w-full border-b border-stone-200 pb-4",
              sidebarCollapsed
                ? "flex flex-col items-center gap-3"
                : "flex items-center justify-between gap-3",
            )}
          >
            <div
              className={cx(
                "inline-flex rounded-full bg-black font-semibold uppercase text-white shadow-sm",
                sidebarCollapsed
                  ? "px-2.5 py-1 text-[10px] tracking-[0.24em]"
                  : "px-3 py-1 text-xs tracking-[0.18em]",
              )}
            >
              BnaaSaaS
            </div>
            <button
              onClick={() => setSidebarCollapsed((current) => !current)}
              title={sidebarCollapsed ? "Ouvrir la barre laterale" : "Reduire la barre laterale"}
              className="flex size-11 items-center justify-center rounded-2xl border border-stone-200 bg-white text-stone-700 hover:bg-stone-100"
              aria-label={sidebarCollapsed ? "Ouvrir la barre laterale" : "Reduire la barre laterale"}
            >
              {sidebarCollapsed ? (
                <PanelLeftOpen className="size-5" />
              ) : (
                <PanelLeftClose className="size-5" />
              )}
            </button>
          </div>

          <nav
            className={cx(
              "soft-scrollbar mt-5 flex-1 w-full space-y-1 overflow-y-auto",
              sidebarCollapsed ? "px-1" : "",
            )}
          >
            {visibleNavItems.map(({ href, label, icon: Icon }) => {
              const active = isActive(pathname, href);
              const sublabel =
                href === "/"
                  ? "Overview"
                  : href === "/documentation"
                    ? "Guides"
                  : href === "/documents"
                    ? "Document control"
                    : href === "/finance"
                      ? "Cashflow"
                      : href === "/site"
                        ? "Field ops"
                        : href === "/notifications"
                          ? "Inbox"
                          : href === "/projects"
                            ? "Portfolio"
                            : "Permissions";

              return (
                <div key={href} className="group relative">
                  <Link
                    href={href}
                    aria-label={label}
                    title={sidebarCollapsed ? `${label} - ${sublabel}` : label}
                    className={cx(
                      "flex min-h-[60px] items-center justify-between rounded-2xl px-3 py-3",
                      active
                        ? "bg-black text-white"
                        : "text-stone-700 hover:bg-stone-100 hover:text-stone-950",
                      sidebarCollapsed ? "w-full justify-center px-2.5" : "",
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cx(
                          "flex size-10 items-center justify-center rounded-2xl border",
                          active
                            ? "border-white/15 bg-white/10 text-white"
                            : "border-stone-200 bg-white text-stone-600",
                        )}
                      >
                        <Icon className="size-5" />
                      </div>
                      {!sidebarCollapsed ? (
                        <div>
                          <p className="text-sm font-semibold">{label}</p>
                          <p
                            className={cx(
                              "text-xs",
                              active ? "text-stone-300" : "text-stone-500",
                            )}
                          >
                            {sublabel}
                          </p>
                        </div>
                      ) : null}
                    </div>
                    {!sidebarCollapsed ? (
                      <ChevronRight
                        className={cx(
                          "size-4",
                          active ? "text-stone-300" : "text-stone-400",
                        )}
                      />
                    ) : null}
                  </Link>
                  {sidebarCollapsed ? (
                    <div className="pointer-events-none absolute left-full top-1/2 z-30 ml-3 -translate-y-1/2 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                      <div className="min-w-max rounded-2xl border border-stone-200 bg-white px-3 py-2 shadow-lg">
                        <p className="text-sm font-semibold text-stone-950">{label}</p>
                        <p className="mt-0.5 text-xs text-stone-500">{sublabel}</p>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </nav>

          <div className="mt-auto w-full">
            <div
              className={cx(
                "rounded-[22px] border border-stone-200 bg-stone-50 p-4",
                sidebarCollapsed ? "px-2 py-3 text-center" : "",
              )}
            >
              {sidebarCollapsed ? (
                <div className="space-y-2">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">
                    {activeProject.code}
                  </div>
                  <div className="font-display text-lg font-semibold text-stone-950">
                    {availableProjects.length}
                  </div>
                  <div className="text-[11px] uppercase tracking-[0.14em] text-stone-500">
                    projets
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">
                    Projet actif
                  </p>
                  <p className="mt-2 text-sm font-semibold text-stone-950">
                    {activeProject.code}
                  </p>
                  <p className="mt-1 text-sm text-stone-600">{activeProject.name}</p>
                  <p className="mt-2 text-xs uppercase tracking-[0.14em] text-stone-500">
                    {currentUser.role}
                  </p>
                  <div className="mt-4">
                    <label
                      htmlFor="sidebar-project-switcher"
                      className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-500"
                    >
                      Changer de projet
                    </label>
                    <select
                      id="sidebar-project-switcher"
                      value={activeProject.id}
                      onChange={(event) => setActiveProjectId(event.target.value)}
                      className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm font-medium text-stone-900 outline-none"
                    >
                      {availableProjects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.name} - {project.code}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}
            </div>
          </div>
        </aside>

        <div className="min-w-0">
          <header className="sticky top-0 z-20 border-b border-stone-200 bg-white/90 px-4 py-4 backdrop-blur md:px-6 lg:px-8">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">
                    <span>{currentNav.label}</span>
                    <span className="size-1 rounded-full bg-stone-300" />
                    <span>{tenant.name}</span>
                  </div>
                  <div>
                    <h2 className="font-display text-2xl font-semibold text-stone-950 md:text-3xl">
                      {activeProject.name}
                    </h2>
                  </div>
                </div>

                <div className="flex flex-col gap-3 lg:min-w-[520px] xl:items-end">
                  <div className="flex w-full flex-col gap-3 md:flex-row xl:justify-end">
                    <label className="flex min-w-[300px] flex-1 items-center gap-3 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-600">
                      <Search className="size-4 text-stone-400" />
                      <input
                        aria-label="Recherche globale"
                        className="w-full bg-transparent text-stone-950 outline-none placeholder:text-stone-400"
                        placeholder="Recherche globale: plan, facture, rapport, NC..."
                      />
                    </label>

                    <div className="flex items-center gap-2">
                      <button className="relative flex size-11 items-center justify-center rounded-2xl border border-stone-200 bg-white text-stone-700 hover:bg-stone-100">
                        <Bell className="size-5" />
                        <span className="absolute right-2 top-2 size-2 rounded-full bg-black" />
                      </button>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setProfileOpen((current) => !current)}
                          className="flex items-center gap-3 rounded-2xl border border-stone-200 bg-white px-3 py-2 shadow-sm hover:bg-stone-50"
                        >
                          <div className="flex size-10 items-center justify-center rounded-2xl bg-black text-sm font-semibold text-white">
                            {currentUser.initials}
                          </div>
                          <div className="text-left">
                            <p className="text-sm font-semibold text-stone-950">
                              {currentUser.name}
                            </p>
                            <p className="text-xs text-stone-500">{currentUser.role}</p>
                          </div>
                        </button>

                        {profileOpen ? (
                          <div className="absolute right-0 top-[calc(100%+0.75rem)] z-30 w-72 rounded-[22px] border border-stone-200 bg-white p-4 shadow-xl">
                            <div className="space-y-1">
                              <p className="text-sm font-semibold text-stone-950">
                                {currentUser.name}
                              </p>
                              <p className="text-sm text-stone-600">{currentUser.email}</p>
                            </div>
                            <div className="mt-4 grid gap-3 sm:grid-cols-2">
                              <div className="rounded-2xl border border-stone-200 bg-stone-50 p-3">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-500">
                                  Role
                                </p>
                                <p className="mt-2 text-sm font-semibold text-stone-950">
                                  {currentUser.role}
                                </p>
                              </div>
                              <div className="rounded-2xl border border-stone-200 bg-stone-50 p-3">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-500">
                                  Projets
                                </p>
                                <p className="mt-2 text-sm font-semibold text-stone-950">
                                  {availableProjects.length} accessibles
                                </p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={handleSignOut}
                              className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm font-semibold text-stone-900 hover:bg-stone-100"
                            >
                              <LogOut className="size-4" />
                              Se deconnecter
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </header>

          <main className="px-4 py-6 pb-28 md:px-6 lg:px-8">{children}</main>
        </div>
      </div>

      <nav className="fixed inset-x-4 bottom-4 z-30 rounded-[24px] border border-stone-200 bg-white p-2 shadow-lg lg:hidden">
        <div className="grid grid-cols-5 gap-1">
          {visibleNavItems.slice(0, 5).map(({ href, shortLabel, icon: Icon }) => {
            const active = isActive(pathname, href);

            return (
              <Link
                key={href}
                href={href}
                className={cx(
                  "flex flex-col items-center gap-1 rounded-2xl px-2 py-3 text-[11px] font-semibold",
                  active ? "bg-black text-white" : "text-stone-500",
                )}
              >
                <Icon className="size-4" />
                <span>{shortLabel}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
