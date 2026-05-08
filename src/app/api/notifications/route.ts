import { NextRequest, NextResponse } from "next/server";

import { sessionCookieName } from "@/lib/backend/session";
import type { NotificationsPageData } from "@/lib/backend/types";
import {
  getNotificationsPayload,
  isApiError,
  mutateNotificationsPayload,
} from "@/lib/backend/service";
import {
  buildAlertsFromNotifications,
} from "@/lib/backend/notification-utils";
import {
  fetchRebuildProjectScope,
  getRebuildAccessTokenFromRequest,
  shouldUseRebuildProjectsBridge,
} from "@/lib/rebuild-auth";
import { workspaceProjects } from "@/lib/mock-data";

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get(sessionCookieName)?.value ?? "";
    const legacyPayload = await getNotificationsPayload(token);

    if (shouldUseRebuildProjectsBridge()) {
      const rebuildAccessToken = getRebuildAccessTokenFromRequest(request);
      const bridgedPayload = await buildNotificationsBridgePayload(
        rebuildAccessToken,
        legacyPayload,
      );

      if (bridgedPayload) {
        return NextResponse.json(bridgedPayload);
      }
    }

    const payload = legacyPayload;
    return NextResponse.json(payload);
  } catch (error) {
    if (isApiError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json({ error: "Erreur notifications." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get(sessionCookieName)?.value ?? "";
    const body = (await request.json()) as {
      action?: "mark-all-read" | "mark-read" | "mark-unread";
      payload?: {
        notificationId?: string;
      };
    };

    if (shouldUseRebuildProjectsBridge() && body.payload?.notificationId) {
      const rebuildAccessToken = getRebuildAccessTokenFromRequest(request);
      const currentPayload = await getNotificationsPayload(token);
      const bridgedPayload = await buildNotificationsBridgePayload(
        rebuildAccessToken,
        currentPayload,
      );

      if (
        bridgedPayload &&
        !bridgedPayload.notifications.some(
          (notification) => notification.id === body.payload?.notificationId,
        )
      ) {
        return NextResponse.json({ error: "Acces notification refuse." }, { status: 403 });
      }
    }

    const legacyPayload = await mutateNotificationsPayload(
      token,
      body.action ?? "mark-read",
      body.payload ?? {},
    );

    if (shouldUseRebuildProjectsBridge()) {
      const rebuildAccessToken = getRebuildAccessTokenFromRequest(request);
      const bridgedPayload = await buildNotificationsBridgePayload(
        rebuildAccessToken,
        legacyPayload,
      );

      if (bridgedPayload) {
        return NextResponse.json(bridgedPayload);
      }
    }

    const payload = legacyPayload;
    return NextResponse.json(payload);
  } catch (error) {
    if (isApiError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json({ error: "Erreur notifications." }, { status: 500 });
  }
}

async function buildNotificationsBridgePayload(
  rebuildAccessToken: string,
  legacyPayload: NotificationsPageData,
): Promise<NotificationsPageData | null> {
  const projectScope = await fetchRebuildProjectScope(
    rebuildAccessToken,
    workspaceProjects,
  );

  if (!projectScope) {
    return null;
  }

  if (projectScope.hasCompatibilityGap) {
    return null;
  }

  const notifications = legacyPayload.notifications.filter(
    (notification) =>
      !notification.projectId || projectScope.allowedProjectIds.has(notification.projectId),
  );
  const activity = legacyPayload.activity.filter(
    (entry) => !entry.projectCode || projectScope.allowedProjectCodes.has(entry.projectCode),
  );

  return {
    alerts: buildAlertsFromNotifications(notifications),
    notifications,
    activity,
    summary: {
      actionRequiredCount: notifications.filter(
        (notification) => notification.requiresAction && !notification.isRead,
      ).length,
      readCount: notifications.filter((notification) => notification.isRead).length,
      totalCount: notifications.length,
      unreadCount: notifications.filter((notification) => !notification.isRead).length,
    },
  };
}
