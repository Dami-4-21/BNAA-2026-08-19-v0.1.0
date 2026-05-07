import type { DashboardAlert, Tone, UserNotification } from "@/lib/backend/types";

export function buildAlertsFromNotifications(
  notifications: UserNotification[],
  projectId?: string,
): DashboardAlert[] {
  return notifications
    .filter((notification) => !notification.isRead)
    .filter((notification) => (projectId ? notification.projectId === projectId : true))
    .sort((left, right) => {
      const toneGap = notificationToneRank(left.tone) - notificationToneRank(right.tone);
      if (toneGap !== 0) {
        return toneGap;
      }

      return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    })
    .slice(0, 4)
    .map((notification) => ({
      title: notification.title,
      detail: notification.detail,
      time: notification.when,
      tone: notification.tone,
    }));
}

export function notificationToneRank(tone: Tone) {
  switch (tone) {
    case "danger":
      return 0;
    case "warning":
      return 1;
    case "primary":
      return 2;
    case "success":
      return 3;
    case "neutral":
    default:
      return 4;
  }
}
