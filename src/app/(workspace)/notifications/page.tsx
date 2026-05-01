"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  BellRing,
  CheckCheck,
  Clock3,
  ExternalLink,
  Filter,
  History,
  MailCheck,
} from "lucide-react";

import { Panel, SectionHeading, StatusBadge, cx } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import type { NotificationsPageData } from "@/lib/backend/types";

type NotificationAction = "mark-all-read" | "mark-read" | "mark-unread";

type FilterStatus = "all" | "action" | "read" | "unread";

export default function NotificationsPage() {
  const [data, setData] = useState<NotificationsPageData | null>(null);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("unread");
  const [typeFilter, setTypeFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [pendingAction, setPendingAction] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadNotifications() {
      try {
        setError("");
        const payload = await apiFetch<NotificationsPageData>("/api/notifications", {
          method: "GET",
        });

        if (!cancelled) {
          setData(payload);
        }
      } catch (nextError) {
        if (!cancelled) {
          setError(
            nextError instanceof Error
              ? nextError.message
              : "Impossible de charger les notifications.",
          );
        }
      }
    }

    void loadNotifications();

    return () => {
      cancelled = true;
    };
  }, []);

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
      if (statusFilter === "unread" && notification.isRead) {
        return false;
      }

      if (statusFilter === "read" && !notification.isRead) {
        return false;
      }

      if (statusFilter === "action" && !notification.requiresAction) {
        return false;
      }

      if (typeFilter !== "all" && notification.type !== typeFilter) {
        return false;
      }

      if (projectFilter !== "all" && notification.projectCode !== projectFilter) {
        return false;
      }

      return true;
    });
  }, [data, projectFilter, statusFilter, typeFilter]);

  async function runNotificationAction(
    action: NotificationAction,
    notificationId?: string,
  ) {
    try {
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
        title="Priorites projet et historique d'activite"
        description="Toutes les actions terrain, documents, finance et administration remontent ici avec un suivi lu / non lu."
        action={<StatusBadge tone="primary">{data.summary.unreadCount} non lues</StatusBadge>}
      />

      <div className="grid gap-4 xl:grid-cols-4">
        <MetricChip label="A traiter" value={`${data.summary.actionRequiredCount}`} />
        <MetricChip label="Non lues" value={`${data.summary.unreadCount}`} />
        <MetricChip label="Lues" value={`${data.summary.readCount}`} />
        <MetricChip label="Total" value={`${data.summary.totalCount}`} />
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
            className="inline-flex items-center gap-2 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-2 text-sm font-semibold text-stone-900 hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <CheckCheck className="size-4" />
            Tout marquer comme lu
          </button>
        }
      >
        <div className="mb-5 grid gap-3 lg:grid-cols-[repeat(3,minmax(0,1fr))]">
          <FilterSelect
            label="Statut"
            value={statusFilter}
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
                    <div className="flex flex-wrap items-center gap-3 text-xs text-stone-500">
                      <span className="inline-flex items-center gap-2">
                        <MailCheck className="size-3.5" />
                        {notification.channel}
                      </span>
                      <span>{notification.actor}</span>
                    </div>
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
                      className="rounded-2xl border border-stone-200 bg-white px-4 py-2 text-sm font-semibold text-stone-900 hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {notification.isRead ? "Marquer non lue" : "Marquer lue"}
                    </button>
                    <Link
                      href={notification.href}
                      className="inline-flex items-center gap-2 rounded-2xl border border-stone-200 bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-stone-800"
                    >
                      Ouvrir
                      <ExternalLink className="size-4" />
                    </Link>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <EmptyState label="Aucune notification ne correspond aux filtres selectionnes." />
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
  label,
  onChange,
  options,
  value,
}: {
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
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm font-medium text-stone-900 outline-none"
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
