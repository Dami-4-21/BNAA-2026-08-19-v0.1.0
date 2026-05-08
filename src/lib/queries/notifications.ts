"use client";

import { apiFetch } from "@/lib/api";
import type { NotificationsPageData } from "@/lib/backend/types";

export type NotificationAction = "mark-all-read" | "mark-read" | "mark-unread";

export const notificationsQueryKey = ["notifications"] as const;

export function fetchNotifications() {
  return apiFetch<NotificationsPageData>("/api/notifications", {
    method: "GET",
  });
}

export function runNotificationsAction(action: NotificationAction, notificationId?: string) {
  return apiFetch<NotificationsPageData>("/api/notifications", {
    method: "POST",
    body: {
      action,
      payload: notificationId ? { notificationId } : {},
    },
  });
}
