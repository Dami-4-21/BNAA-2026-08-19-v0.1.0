"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  Building2,
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
import { apiFetch } from "@/lib/api";
import type {
  GlobalSearchPayload,
  GlobalSearchResult,
  NotificationsPageData,
} from "@/lib/backend/types";
import { useWorkspace } from "@/components/workspace-context";

type NavItem = {
  href: string;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  permission: AppPermission;
};

const searchSectionLabel: Record<GlobalSearchResult["section"], string> = {
  document: "Document",
  invoice: "Facture",
  project: "Projet",
  report: "Rapport",
  user: "Utilisateur",
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

function SearchResultIcon({ section }: { section: GlobalSearchResult["section"] }) {
  switch (section) {
    case "project":
      return <Building2 className="size-4" />;
    case "report":
      return <SquarePen className="size-4" />;
    case "document":
      return <FileStack className="size-4" />;
    case "invoice":
      return <CircleDollarSign className="size-4" />;
    case "user":
      return <ShieldCheck className="size-4" />;
    default:
      return <Search className="size-4" />;
  }
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
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsData, setNotificationsData] = useState<NotificationsPageData | null>(
    null,
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<GlobalSearchResult[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchBoxRef = useRef<HTMLDivElement | null>(null);
  const notificationsBoxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    window.localStorage.setItem(
      "bnaasaas-sidebar-collapsed",
      String(sidebarCollapsed),
    );
  }, [sidebarCollapsed]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!searchBoxRef.current?.contains(event.target as Node)) {
        setSearchOpen(false);
      }

      if (!notificationsBoxRef.current?.contains(event.target as Node)) {
        setNotificationsOpen(false);
      }
    }

    window.addEventListener("mousedown", handlePointerDown);
    return () => window.removeEventListener("mousedown", handlePointerDown);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadNotifications() {
      try {
        const payload = await apiFetch<NotificationsPageData>("/api/notifications", {
          method: "GET",
        });

        if (!cancelled) {
          setNotificationsData(payload);
        }
      } catch {
        if (!cancelled) {
          setNotificationsData(null);
        }
      }
    }

    void loadNotifications();
    const interval = window.setInterval(() => {
      void loadNotifications();
    }, 20000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [currentUser.id, pathname]);

  useEffect(() => {
    const needle = searchQuery.trim();
    if (needle.length < 2) {
      return;
    }

    let cancelled = false;

    const timer = window.setTimeout(async () => {
      try {
        const payload = await apiFetch<GlobalSearchPayload>(
          `/api/search?q=${encodeURIComponent(needle)}`,
          {
            method: "GET",
          },
        );

        if (!cancelled) {
          setSearchResults(payload.results);
          setSearchOpen(true);
        }
      } catch {
        if (!cancelled) {
          setSearchResults([]);
        }
      } finally {
        if (!cancelled) {
          setSearchLoading(false);
        }
      }
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [searchQuery]);

  const visibleNavItems = navItems.filter((item) => can(item.permission));
  const searchSummary = useMemo(() => {
    const counts = searchResults.reduce<Record<GlobalSearchResult["section"], number>>(
      (summary, result) => ({
        ...summary,
        [result.section]: (summary[result.section] ?? 0) + 1,
      }),
      {
        project: 0,
        report: 0,
        document: 0,
        invoice: 0,
        user: 0,
      },
    );

    return [
      counts.project ? `${counts.project} projet(s)` : null,
      counts.report ? `${counts.report} rapport(s)` : null,
      counts.document ? `${counts.document} document(s)` : null,
      counts.invoice ? `${counts.invoice} facture(s)` : null,
      counts.user ? `${counts.user} utilisateur(s)` : null,
    ]
      .filter(Boolean)
      .join(" · ");
  }, [searchResults]);

  const currentNav =
    visibleNavItems.find((item) => item.href !== "/" && pathname.startsWith(item.href)) ??
    visibleNavItems.find((item) => item.href === pathname) ??
    visibleNavItems[0] ??
    navItems[0];

  async function handleSignOut() {
    await signOut();
    router.replace("/login");
  }

  function handleSearchSelect(result: GlobalSearchResult) {
    if (result.projectId) {
      setActiveProjectId(result.projectId);
    }
    setSearchOpen(false);
    setSearchQuery("");
    setSearchResults([]);
    router.push(result.href);
  }

  function handleSearchSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (searchResults[0]) {
      handleSearchSelect(searchResults[0]);
    }
  }

  function handleSearchChange(value: string) {
    setSearchQuery(value);
    if (value.trim().length < 2) {
      setSearchResults([]);
      setSearchLoading(false);
      setSearchOpen(false);
      return;
    }

    setSearchLoading(true);
  }

  async function handleNotificationSelect(
    notification: NonNullable<NotificationsPageData["notifications"]>[number],
  ) {
    if (!notification.isRead) {
      try {
        const payload = await apiFetch<NotificationsPageData>("/api/notifications", {
          method: "POST",
          body: {
            action: "mark-read",
            payload: { notificationId: notification.id },
          },
        });
        setNotificationsData(payload);
      } catch {
        // noop for preview navigation
      }
    }

    if (notification.projectId) {
      setActiveProjectId(notification.projectId);
    }

    setNotificationsOpen(false);
    router.push(notification.href);
  }

  const notificationPreview = notificationsData?.notifications.slice(0, 5) ?? [];
  const unreadNotifications = notificationsData?.summary.unreadCount ?? 0;

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
                    <div ref={searchBoxRef} className="relative min-w-[300px] flex-1">
                      <form
                        onSubmit={handleSearchSubmit}
                        className="flex items-center gap-3 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-600"
                      >
                        <Search className="size-4 text-stone-400" />
                        <input
                          aria-label="Recherche globale"
                          value={searchQuery}
                          onChange={(event) => handleSearchChange(event.target.value)}
                          onFocus={() => {
                            if (searchResults.length > 0 || searchQuery.trim().length >= 2) {
                              setSearchOpen(true);
                            }
                          }}
                          className="w-full bg-transparent text-stone-950 outline-none placeholder:text-stone-400"
                          placeholder="Recherche globale: plan, facture, rapport, utilisateur..."
                        />
                      </form>

                      {searchOpen || searchLoading || searchQuery.trim().length >= 2 ? (
                        <div className="absolute left-0 right-0 top-[calc(100%+0.75rem)] z-30 overflow-hidden rounded-[24px] border border-stone-200 bg-white shadow-xl">
                          <div className="border-b border-stone-200 px-4 py-3">
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">
                              Recherche globale
                            </p>
                            <p className="mt-1 text-sm text-stone-600">
                              {searchLoading
                                ? "Recherche en cours..."
                                : searchResults.length > 0
                                  ? searchSummary
                                  : searchQuery.trim().length >= 2
                                    ? "Aucun resultat pour cette recherche"
                                    : "Commencez a taper pour rechercher"}
                            </p>
                          </div>
                          <div className="max-h-[420px] overflow-y-auto p-2">
                            {searchResults.map((result) => (
                              <button
                                key={result.id}
                                onClick={() => handleSearchSelect(result)}
                                className="flex w-full items-start gap-3 rounded-2xl px-3 py-3 text-left hover:bg-stone-50"
                              >
                                <div className="mt-0.5 flex size-10 items-center justify-center rounded-2xl border border-stone-200 bg-stone-50 text-stone-700">
                                  <SearchResultIcon section={result.section} />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="truncate text-sm font-semibold text-stone-950">
                                      {result.label}
                                    </p>
                                    <span className="rounded-full border border-stone-200 bg-stone-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-500">
                                      {searchSectionLabel[result.section]}
                                    </span>
                                    {result.projectCode ? (
                                      <span className="rounded-full border border-stone-200 bg-stone-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-500">
                                        {result.projectCode}
                                      </span>
                                    ) : null}
                                  </div>
                                  <p className="mt-1 text-sm text-stone-600">{result.meta}</p>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>

                    <div className="flex items-center gap-2">
                      <div ref={notificationsBoxRef} className="relative">
                        <button
                          type="button"
                          onClick={() => setNotificationsOpen((current) => !current)}
                          className="relative flex size-11 items-center justify-center rounded-2xl border border-stone-200 bg-white text-stone-700 hover:bg-stone-100"
                        >
                          <Bell className="size-5" />
                          {unreadNotifications > 0 ? (
                            <>
                              <span className="absolute right-2 top-2 size-2 rounded-full bg-black" />
                              <span className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-black px-1.5 py-0.5 text-[10px] font-semibold text-white">
                                {unreadNotifications}
                              </span>
                            </>
                          ) : null}
                        </button>

                        {notificationsOpen ? (
                          <div className="absolute right-0 top-[calc(100%+0.75rem)] z-30 w-[360px] overflow-hidden rounded-[24px] border border-stone-200 bg-white shadow-xl">
                            <div className="border-b border-stone-200 px-4 py-3">
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">
                                    Notifications
                                  </p>
                                  <p className="mt-1 text-sm text-stone-600">
                                    {unreadNotifications > 0
                                      ? `${unreadNotifications} action(s) ou informations en attente`
                                      : "Aucune notification non lue"}
                                  </p>
                                </div>
                                <Link
                                  href="/notifications"
                                  onClick={() => setNotificationsOpen(false)}
                                  className="text-sm font-semibold text-stone-950 hover:text-stone-600"
                                >
                                  Tout voir
                                </Link>
                              </div>
                            </div>
                            <div className="max-h-[420px] overflow-y-auto p-2">
                              {notificationPreview.length > 0 ? (
                                notificationPreview.map((notification) => (
                                  <button
                                    key={notification.id}
                                    onClick={() => void handleNotificationSelect(notification)}
                                    className="w-full rounded-2xl px-3 py-3 text-left hover:bg-stone-50"
                                  >
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                          <p className="truncate text-sm font-semibold text-stone-950">
                                            {notification.title}
                                          </p>
                                          {!notification.isRead ? (
                                            <span className="rounded-full bg-black px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white">
                                              Nouveau
                                            </span>
                                          ) : null}
                                        </div>
                                        <p className="mt-1 line-clamp-2 text-sm text-stone-600">
                                          {notification.detail}
                                        </p>
                                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-stone-500">
                                          <span>{notification.when}</span>
                                          {notification.projectCode ? (
                                            <span>{notification.projectCode}</span>
                                          ) : null}
                                        </div>
                                      </div>
                                    </div>
                                  </button>
                                ))
                              ) : (
                                <div className="px-3 py-8 text-center text-sm text-stone-500">
                                  Aucun evenement recent.
                                </div>
                              )}
                            </div>
                          </div>
                        ) : null}
                      </div>
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
