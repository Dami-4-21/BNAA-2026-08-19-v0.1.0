"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BellRing,
  CheckCheck,
  Clock3,
  ExternalLink,
  Filter,
  History,
  MailCheck,
  Search,
} from "lucide-react";

import { Panel, SectionHeading, StatusBadge, cx } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import type { NotificationsPageData } from "@/lib/backend/types";
import { useWorkspace } from "@/components/workspace-context";

type NotificationAction = "mark-all-read" | "mark-read" | "mark-unread";

type FilterStatus = "all" | "action" | "read" | "unread";
type NotificationView = "inbox" | "validations" | "alerts";

const emailToneByStatus = {
  captured: "warning",
  failed: "danger",
  not_applicable: "neutral",
  queued: "primary",
  sent: "success",
} as const;

const emailLabelByStatus = {
  captured: "Email capture",
  failed: "Email erreur",
  not_applicable: "Sans email",
  queued: "Email en file",
  sent: "Email envoye",
} as const;

export default function NotificationsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setActiveProjectId } = useWorkspace();
  const [data, setData] = useState<NotificationsPageData | null>(null);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("unread");
  const [typeFilter, setTypeFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [pendingAction, setPendingAction] = useState("");
  const view = (searchParams.get("view") as NotificationView | null) ?? "inbox";
  const effectiveStatusFilter: FilterStatus =
    view === "validations" ? "action" : view === "alerts" ? "unread" : statusFilter;

  const loadNotifications = useCallback(async (options?: { preserveData?: boolean }) => {
    try {
      setError("");
      if (!options?.preserveData) {
        setData(null);
      }
      const payload = await apiFetch<NotificationsPageData>("/api/notifications", {
        method: "GET",
      });
      setData(payload);
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Impossible de charger les notifications.",
      );
      if (!options?.preserveData) {
        setData(null);
      }
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadNotifications();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadNotifications]);

  useEffect(() => {
    function refreshOnForeground() {
      if (document.visibilityState === "hidden") {
        return;
      }

      void loadNotifications({ preserveData: true });
    }

    window.addEventListener("focus", refreshOnForeground);
    document.addEventListener("visibilitychange", refreshOnForeground);

    return () => {
      window.removeEventListener("focus", refreshOnForeground);
      document.removeEventListener("visibilitychange", refreshOnForeground);
    };
  }, [loadNotifications]);

  const typeOptions = useMemo(
    () =>
      Array.from(new Set((data?.notifications ?? []).map((notification) => notification.type))),
    [data],
  );
  const projectOptions = useMemo(
    () =>
      Array.from(
        new Set(
          (data?.notifications ?? [])
            .map((notification) => notification.projectCode)
            .filter((projectCode): projectCode is string => Boolean(projectCode)),
        ),
      ),
    [data],
  );

  const filteredNotifications = useMemo(() => {
    return (data?.notifications ?? []).filter((notification) => {
      if (effectiveStatusFilter === "unread" && notification.isRead) {
        return false;
      }

      if (effectiveStatusFilter === "read" && !notification.isRead) {
        return false;
      }

      if (effectiveStatusFilter === "action" && !notification.requiresAction) {
        return false;
      }

      if (typeFilter !== "all" && notification.type !== typeFilter) {
        return false;
      }

      if (projectFilter !== "all" && notification.projectCode !== projectFilter) {
        return false;
      }

      const needle = search.trim().toLowerCase();
      if (
        needle &&
        ![
          notification.title,
          notification.detail,
          notification.actor,
          notification.projectCode ?? "",
          notification.type,
        ]
          .join(" ")
          .toLowerCase()
          .includes(needle)
      ) {
        return false;
      }

      return true;
    });
  }, [data, effectiveStatusFilter, projectFilter, search, typeFilter]);

  const quickFilters = [
    {
      label: "Non lues",
      value: "unread" as FilterStatus,
      count: data?.summary.unreadCount ?? 0,
    },
    {
      label: "A traiter",
      value: "action" as FilterStatus,
      count: data?.summary.actionRequiredCount ?? 0,
    },
    {
      label: "Toutes",
      value: "all" as FilterStatus,
      count: data?.summary.totalCount ?? 0,
    },
  ];
  const heading = {
    inbox: {
      actionBadge: `${data?.summary.unreadCount ?? 0} non lues`,
      description:
        "Toutes les actions terrain, documents, finance et administration remontent ici avec un suivi lu / non lu.",
      title: "Priorites projet et historique d'activite",
    },
    validations: {
      actionBadge: `${data?.summary.actionRequiredCount ?? 0} a traiter`,
      description:
        "Vue raccourcie pour reprendre les signatures, validations documentaires et validations finance sans parcourir toute la boite de reception.",
      title: "File de validations a traiter",
    },
    alerts: {
      actionBadge: `${data?.summary.unreadCount ?? 0} alertes`,
      description:
        "Vue orientee priorites pour revenir vite sur les alertes non lues et les points qui bloquent le projet.",
      title: "Alertes et signaux a surveiller",
    },
  }[view];

  const markAllReadHelper =
    pendingAction === "mark-all-read"
      ? "Mise a jour des notifications en cours."
      : data?.summary.unreadCount
        ? "Marquer toutes les notifications visibles comme lues."
        : "Toutes les notifications sont deja lues.";
  const queuedEmails = (data?.notifications ?? []).filter(
    (notification) => notification.emailStatus === "queued" || notification.emailStatus === "captured",
  ).length;
  const projectCount = new Set(
    (data?.notifications ?? [])
      .map((notification) => notification.projectCode)
      .filter((projectCode): projectCode is string => Boolean(projectCode)),
  ).size;

  function resetFilters() {
    setStatusFilter("unread");
    setTypeFilter("all");
    setProjectFilter("all");
    setSearch("");
  }

  async function runNotificationAction(
    action: NotificationAction,
    notificationId?: string,
  ) {
    try {
      setError("");
      setPendingAction(notificationId ?? action);
      const payload = await apiFetch<NotificationsPageData>("/api/notifications", {
        method: "POST",
        body: {
          action,
          payload: notificationId ? { notificationId } : {},
        },
      });
      setData(payload);
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Impossible de mettre a jour les notifications.",
      );
    } finally {
      setPendingAction("");
    }
  }

  async function openNotification(
    notification: NonNullable<NotificationsPageData["notifications"]>[number],
  ) {
    try {
      setPendingAction(notification.id);
      setError("");

      if (!notification.href) {
        throw new Error("Cette notification ne pointe vers aucun ecran.");
      }

      if (!notification.isRead) {
        const payload = await apiFetch<NotificationsPageData>("/api/notifications", {
          method: "POST",
          body: {
            action: "mark-read",
            payload: { notificationId: notification.id },
          },
        });
        setData(payload);
      }

      if (notification.projectId) {
        setActiveProjectId(notification.projectId);
      }

      router.push(notification.href);
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Impossible d'ouvrir la notification.",
      );
      setPendingAction("");
    }
  }

  if (!data && !error) {
    return (
      <div className="space-y-6">
        <SectionHeading
          eyebrow="Notifications"
          title="Chargement des alertes et de l'activite"
          action={<StatusBadge tone="neutral">Synchronisation</StatusBadge>}
        />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <SectionHeading
          eyebrow="Notifications"
          title="Le centre de notifications n'est pas disponible"
          action={<StatusBadge tone="danger">Erreur</StatusBadge>}
        />
        <Panel>{error}</Panel>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Notifications"
        title={heading.title}
        description={heading.description}
        action={<StatusBadge tone="primary">{heading.actionBadge}</StatusBadge>}
      />

      <div className="grid gap-4 xl:grid-cols-4">
        <MetricChip label="A traiter" value={`${data.summary.actionRequiredCount}`} />
        <MetricChip label="Non lues" value={`${data.summary.unreadCount}`} />
        <MetricChip label="Lues" value={`${data.summary.readCount}`} />
        <MetricChip label="Total" value={`${data.summary.totalCount}`} />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title="Triage rapide" description="Les signaux utiles pour savoir ou reprendre sans relire toute la liste.">
          <div className="grid gap-3 sm:grid-cols-3">
            <MetricChip label="Actions" value={`${data.summary.actionRequiredCount}`} />
            <MetricChip label="Emails a sortir" value={`${queuedEmails}`} />
            <MetricChip label="Projets touches" value={`${projectCount}`} />
          </div>
        </Panel>
        <Panel title="Raccourcis de lecture" description="Choisissez un angle de tri avant d'ouvrir les notifications une par une.">
          <div className="flex flex-wrap gap-2">
            {quickFilters.map((filter) => (
              <button
                key={`top-${filter.value}`}
                type="button"
                onClick={() => setStatusFilter(filter.value)}
                className={cx(
                  "rounded-full border px-4 py-2 text-sm font-semibold transition-colors",
                  effectiveStatusFilter === filter.value
                    ? "border-black bg-black text-white"
                    : "border-stone-200 bg-white text-stone-600 hover:bg-stone-100",
                )}
              >
                {filter.label} <span className="ml-2 text-xs opacity-80">{filter.count}</span>
              </button>
            ))}
          </div>
          <p className="mt-3 text-sm leading-6 text-stone-600">
            Combinez ensuite le type, le projet et la recherche libre pour isoler une action precise.
          </p>
        </Panel>
        <Panel title="Flux email" description="Verifiez en un coup d'oeil si les notifications critiques quittent bien le SaaS.">
          <div className="space-y-3">
            <div className="rounded-[22px] border border-stone-200 bg-stone-50 p-4 text-sm leading-6 text-stone-600">
              <span className="font-semibold text-stone-950">{queuedEmails}</span> notification(s) attendent encore un envoi ou sont capturees localement.
            </div>
            <div className="rounded-[22px] border border-stone-200 bg-stone-50 p-4 text-sm leading-6 text-stone-600">
              Les statuts <span className="font-semibold text-stone-950">Email en file</span> et <span className="font-semibold text-stone-950">Email capture</span> meritent une verification en priorite.
            </div>
          </div>
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <Panel
          title="Actions prioritaires"
          description="Les notifications non lues et critiques remontent en tete pour accelerer les validations et les actions terrain."
        >
          <div className="space-y-3">
            {data.alerts.length > 0 ? (
              data.alerts.map((alert) => (
                <div
                  key={`${alert.title}-${alert.time}`}
                  className="rounded-[22px] border border-stone-200 bg-stone-50 p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <BellRing className="size-4 text-stone-500" />
                      <p className="text-sm font-semibold text-stone-950">{alert.title}</p>
                    </div>
                    <StatusBadge tone={alert.tone}>{alert.time}</StatusBadge>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-stone-600">{alert.detail}</p>
                </div>
              ))
            ) : (
              <EmptyState label="Aucune alerte prioritaire pour le moment." />
            )}
          </div>
        </Panel>

        <Panel
          title="Activite recente"
          description="Journal backend des operations les plus recentes sur les projets accessibles."
        >
          <div className="space-y-3">
            {data.activity.length > 0 ? (
              data.activity.map((entry) => (
                <div
                  key={`${entry.id ?? entry.at}-${entry.actor}-${entry.context}`}
                  className="rounded-[22px] border border-stone-200 bg-stone-50 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <History className="mt-0.5 size-4 text-stone-500" />
                      <div>
                        <p className="text-sm font-semibold text-stone-950">
                          {entry.actor} {entry.action}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-stone-600">
                          {entry.context}
                        </p>
                      </div>
                    </div>
                    <p className="text-xs uppercase tracking-[0.16em] text-stone-500">
                      {entry.at}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState label="Aucune activite recente pour votre perimetre." />
            )}
          </div>
        </Panel>
      </div>

      <Panel
        title="Toutes les notifications"
        description="Filtrez les notifications par statut, type ou projet sans quitter le flux courant."
        action={
          <button
            type="button"
            onClick={() => void runNotificationAction("mark-all-read")}
            disabled={pendingAction === "mark-all-read" || data.summary.unreadCount === 0}
            title={markAllReadHelper}
            className="inline-flex items-center gap-2 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-2 text-sm font-semibold text-stone-900 hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <CheckCheck className="size-4" />
            Tout marquer comme lu
          </button>
        }
      >
        <div className="mb-4 flex flex-wrap gap-2">
          {quickFilters.map((filter) => (
            <button
              key={filter.value}
              type="button"
              onClick={() => setStatusFilter(filter.value)}
              className={cx(
                "rounded-full border px-4 py-2 text-sm font-semibold transition-colors",
                effectiveStatusFilter === filter.value
                  ? "border-black bg-black text-white"
                  : "border-stone-200 bg-white text-stone-600 hover:bg-stone-100",
              )}
            >
              {filter.label} <span className="ml-2 text-xs opacity-80">{filter.count}</span>
            </button>
          ))}
        </div>

        <div className="mb-5 grid gap-3 lg:grid-cols-[1.2fr_repeat(3,minmax(0,1fr))]">
          <label className="space-y-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-500">
              Recherche
            </span>
            <div className="flex items-center gap-3 rounded-2xl border border-stone-200 bg-white px-4 py-3">
              <Search className="size-4 text-stone-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Titre, detail, acteur, projet..."
                className="w-full bg-transparent text-sm font-medium text-stone-900 outline-none placeholder:text-stone-400"
              />
            </div>
          </label>
            <FilterSelect
              label="Statut"
              value={effectiveStatusFilter}
              disabled={view !== "inbox"}
              onChange={(value) => setStatusFilter(value as FilterStatus)}
              options={[
                { label: "Non lues", value: "unread" },
                { label: "Toutes", value: "all" },
              { label: "A traiter", value: "action" },
              { label: "Lues", value: "read" },
            ]}
          />
          <FilterSelect
            label="Type"
            value={typeFilter}
            onChange={setTypeFilter}
            options={[
              { label: "Tous les types", value: "all" },
              ...typeOptions.map((type) => ({
                label: type,
                value: type,
              })),
            ]}
          />
          <FilterSelect
            label="Projet"
            value={projectFilter}
            onChange={setProjectFilter}
            options={[
              { label: "Tous les projets", value: "all" },
              ...projectOptions.map((project) => ({
                label: project,
                value: project,
              })),
            ]}
          />
        </div>

        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-[22px] border border-stone-200 bg-stone-50 px-4 py-4 text-sm text-stone-600">
          <p>
            <span className="font-semibold text-stone-950">{filteredNotifications.length}</span> notification(s) correspondent aux filtres actuels.
          </p>
          <button
            type="button"
            onClick={resetFilters}
            className="rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-semibold text-stone-900 hover:bg-stone-100"
          >
            Reinitialiser les filtres
          </button>
        </div>

        <div className="space-y-3">
          {filteredNotifications.length > 0 ? (
            filteredNotifications.map((notification) => (
              <div
                key={notification.id}
                className={cx(
                  "rounded-[24px] border p-4 transition-colors",
                  notification.isRead
                    ? "border-stone-200 bg-white"
                    : "border-black/10 bg-stone-50",
                )}
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge tone={notification.tone}>
                        {notification.requiresAction ? "Action requise" : "Information"}
                      </StatusBadge>
                      <span className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">
                        <Filter className="size-3" />
                        {notification.type}
                      </span>
                      {notification.projectCode ? (
                        <span className="inline-flex items-center rounded-full border border-stone-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">
                          {notification.projectCode}
                        </span>
                      ) : null}
                      <span className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-3 py-1 text-xs text-stone-500">
                        <Clock3 className="size-3" />
                        {notification.when}
                      </span>
                    </div>
                    <div>
                      <p className="text-base font-semibold text-stone-950">
                        {notification.title}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-stone-600">
                        {notification.detail}
                      </p>
                    </div>
                    {notification.requiresAction ? (
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-amber-800">
                        Action attendue de votre part
                      </div>
                    ) : null}
                    <div className="flex flex-wrap items-center gap-3 text-xs text-stone-500">
                      <span className="inline-flex items-center gap-2">
                        <MailCheck className="size-3.5" />
                        {notification.channel}
                      </span>
                      <StatusBadge tone={emailToneByStatus[notification.emailStatus]}>
                        {emailLabelByStatus[notification.emailStatus]}
                      </StatusBadge>
                      <span>{notification.actor}</span>
                    </div>
                    {notification.emailError ? (
                      <p className="text-xs leading-5 text-stone-500">
                        {notification.emailError}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        void runNotificationAction(
                          notification.isRead ? "mark-unread" : "mark-read",
                          notification.id,
                        )
                      }
                      disabled={pendingAction === notification.id}
                      title={
                        pendingAction === notification.id
                          ? "Mise a jour en cours."
                          : notification.isRead
                            ? "Remettre cette notification dans vos elements non lus."
                            : "Marquer cette notification comme lue."
                      }
                      className="rounded-2xl border border-stone-200 bg-white px-4 py-2 text-sm font-semibold text-stone-900 hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {notification.isRead ? "Marquer non lue" : "Marquer lue"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void openNotification(notification)}
                      disabled={pendingAction === notification.id || !notification.href}
                      title={
                        pendingAction === notification.id
                          ? "Ouverture de la notification en cours."
                          : notification.href
                            ? "Ouvrir l'ecran cible et synchroniser le projet courant."
                            : "Aucun ecran n'est rattache a cette notification."
                      }
                      className="inline-flex items-center gap-2 rounded-2xl border border-stone-200 bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Ouvrir
                      <ExternalLink className="size-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <EmptyState label="Aucune notification ne correspond aux filtres selectionnes. Reinitialisez les filtres ou reduisez la recherche pour retrouver le bon flux." />
          )}
        </div>
      </Panel>
    </div>
  );
}

function MetricChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass-panel-soft rounded-[22px] p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">
        {label}
      </p>
      <p className="mt-3 font-display text-3xl font-semibold text-stone-950">{value}</p>
    </div>
  );
}

function FilterSelect({
  disabled = false,
  label,
  onChange,
  options,
  value,
}: {
  disabled?: boolean;
  label: string;
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
  value: string;
}) {
  return (
    <label className="space-y-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-500">
        {label}
      </span>
      <select
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={cx(
          "w-full rounded-2xl border px-4 py-3 text-sm font-medium outline-none",
          disabled
            ? "cursor-not-allowed border-stone-200 bg-stone-100 text-stone-500"
            : "border-stone-200 bg-white text-stone-900",
        )}
      >
        {options.map((option) => (
          <option key={`${label}-${option.value}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-[22px] border border-dashed border-stone-200 bg-stone-50 px-4 py-8 text-center text-sm text-stone-500">
      {label}
    </div>
  );
}
