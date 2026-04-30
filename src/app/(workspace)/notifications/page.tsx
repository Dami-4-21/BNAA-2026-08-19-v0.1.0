import { BellRing, Clock3, SendHorizontal } from "lucide-react";

import { Panel, SectionHeading, StatusBadge } from "@/components/ui";
import { alerts, notifications } from "@/lib/mock-data";

export default function NotificationsPage() {
  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Inbox"
        title="Un centre d'alertes priorise et actionnable"
        action={<StatusBadge tone="primary">Email + in-app</StatusBadge>}
      />

      <div className="grid gap-6 2xl:grid-cols-[1fr_1fr]">
        <Panel title="Priorites du jour">
          <div className="space-y-3">
            {alerts.map((alert) => (
              <div
                key={alert.title}
                className="rounded-[22px] border border-white/8 bg-white/4 p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <BellRing className="size-4 text-slate-400" />
                    <p className="text-sm font-semibold text-white">{alert.title}</p>
                  </div>
                  <StatusBadge tone={alert.tone}>{alert.time}</StatusBadge>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-300">{alert.detail}</p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Canaux et formats">
          <div className="space-y-3">
            {notifications.map((notification) => (
              <div
                key={`${notification.title}-${notification.when}`}
                className="rounded-[22px] border border-white/8 bg-white/4 p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-white">{notification.title}</p>
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <Clock3 className="size-4" />
                    {notification.when}
                  </div>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  {notification.detail}
                </p>
                <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/5 px-3 py-1 text-xs text-slate-300">
                  <SendHorizontal className="size-3" />
                  {notification.channel}
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

    </div>
  );
}
