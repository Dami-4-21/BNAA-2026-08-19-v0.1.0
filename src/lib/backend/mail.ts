import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import nodemailer from "nodemailer";

import { getDataDirectory } from "@/lib/backend/store";
import type { AppUser } from "@/lib/auth";
import type { NotificationRecord } from "@/lib/backend/types";

type MailDispatchResult =
  | { deliveredAt: string; detail: string; status: "captured" }
  | { deliveredAt: string; detail: string; status: "sent" }
  | { deliveredAt?: string; detail: string; status: "failed" };

const defaultAppUrl = process.env.BNAASAAS_APP_URL?.trim() || "http://192.168.100.211:3000";

function getMailerConfig() {
  const host = process.env.BNAASAAS_SMTP_HOST?.trim();
  const port = Number(process.env.BNAASAAS_SMTP_PORT ?? "587");
  const user = process.env.BNAASAAS_SMTP_USER?.trim();
  const pass = process.env.BNAASAAS_SMTP_PASS?.trim();
  const from = process.env.BNAASAAS_SMTP_FROM?.trim();
  const secure = process.env.BNAASAAS_SMTP_SECURE === "true";

  if (!host || !from) {
    return null;
  }

  return {
    auth: user && pass ? { pass, user } : undefined,
    from,
    host,
    port: Number.isFinite(port) ? port : 587,
    secure,
  };
}

function createMailContent(input: {
  notification: NotificationRecord;
  projectName?: string;
  recipient: Pick<AppUser, "email" | "name">;
}) {
  const href = input.notification.href.startsWith("http")
    ? input.notification.href
    : `${defaultAppUrl}${input.notification.href}`;
  const projectLine = input.projectName
    ? `Projet: ${input.projectName}${input.notification.projectCode ? ` (${input.notification.projectCode})` : ""}`
    : input.notification.projectCode
      ? `Projet: ${input.notification.projectCode}`
      : "";

  const lines = [
    `Bonjour ${input.recipient.name},`,
    "",
    input.notification.title,
    input.notification.detail,
    projectLine,
    input.notification.requiresAction ? "Action requise: oui" : "Action requise: non",
    `Ouvrir dans BnaaSaaS: ${href}`,
    "",
    `Evenement: ${input.notification.type}`,
    `Canal: ${input.notification.channel}`,
    "",
    "Message automatique BnaaSaaS.",
  ].filter(Boolean);

  return {
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
        <p>Bonjour ${input.recipient.name},</p>
        <h2 style="margin:0 0 12px">${input.notification.title}</h2>
        <p style="margin:0 0 12px">${input.notification.detail}</p>
        ${projectLine ? `<p style="margin:0 0 12px"><strong>${projectLine}</strong></p>` : ""}
        <p style="margin:0 0 18px">Action requise: <strong>${input.notification.requiresAction ? "oui" : "non"}</strong></p>
        <p style="margin:0 0 18px">
          <a href="${href}" style="display:inline-block;background:#111827;color:#ffffff;padding:12px 16px;border-radius:12px;text-decoration:none">
            Ouvrir dans BnaaSaaS
          </a>
        </p>
        <p style="font-size:12px;color:#6b7280">Message automatique BnaaSaaS.</p>
      </div>
    `,
    subject: `[BnaaSaaS] ${input.notification.title}`,
    text: lines.join("\n"),
  };
}

async function captureMailToOutbox(input: {
  notification: NotificationRecord;
  projectName?: string;
  recipients: Array<Pick<AppUser, "email" | "name">>;
}) {
  const outboxDirectory = path.join(getDataDirectory(), "mail-outbox");
  await mkdir(outboxDirectory, { recursive: true });

  const deliveredAt = new Date().toISOString();
  const fileName = `${deliveredAt.replace(/[:.]/g, "-")}-${input.notification.id}.json`;
  const payload = {
    deliveredAt,
    notification: {
      channel: input.notification.channel,
      detail: input.notification.detail,
      href: input.notification.href,
      id: input.notification.id,
      projectCode: input.notification.projectCode,
      title: input.notification.title,
      type: input.notification.type,
    },
    projectName: input.projectName,
    recipients: input.recipients.map((recipient) => ({
      email: recipient.email,
      name: recipient.name,
      ...createMailContent({
        notification: input.notification,
        projectName: input.projectName,
        recipient,
      }),
    })),
  };

  await writeFile(
    path.join(outboxDirectory, fileName),
    JSON.stringify(payload, null, 2),
    "utf-8",
  );

  return {
    deliveredAt,
    detail: `Capture locale dans data/mail-outbox/${fileName}`,
    status: "captured" as const,
  };
}

export async function dispatchNotificationEmail(input: {
  notification: NotificationRecord;
  projectName?: string;
  recipients: Array<Pick<AppUser, "email" | "name">>;
}) : Promise<MailDispatchResult> {
  if (input.recipients.length === 0) {
    return {
      detail: "Aucun destinataire email resolu pour cette notification.",
      status: "failed",
    };
  }

  const config = getMailerConfig();
  if (!config) {
    return captureMailToOutbox(input);
  }

  const transporter = nodemailer.createTransport({
    auth: config.auth,
    host: config.host,
    port: config.port,
    secure: config.secure,
  });

  const results = await Promise.allSettled(
    input.recipients.map((recipient) => {
      const content = createMailContent({
        notification: input.notification,
        projectName: input.projectName,
        recipient,
      });

      return transporter.sendMail({
        from: config.from,
        html: content.html,
        subject: content.subject,
        text: content.text,
        to: recipient.email,
      });
    }),
  );

  const failures = results.filter((result) => result.status === "rejected");
  if (failures.length > 0) {
    return {
      detail: failures
        .map((failure) =>
          failure.status === "rejected" && failure.reason instanceof Error
            ? failure.reason.message
            : "Erreur SMTP inconnue.",
        )
        .join(" | "),
      status: "failed",
    };
  }

  return {
    deliveredAt: new Date().toISOString(),
    detail: `${input.recipients.length} email(s) envoye(s) via SMTP.`,
    status: "sent",
  };
}
