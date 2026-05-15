import type { JobsOptions } from "bullmq";

import type { QueueName } from "@/queue/queue.constants";

export type QueueDispatchMode = "disabled" | "queued";

export type QueueDispatchResult = {
  mode: QueueDispatchMode;
  queue: QueueName;
  jobId?: string;
  jobName: string;
  reason?: string;
};

export type QueueEnqueueInput<TPayload> = {
  jobId?: string;
  jobName: string;
  options?: JobsOptions;
  payload: TPayload;
  queue: QueueName;
};

export type EmailQueuePayload =
  | {
      kind: "invite";
      payload: {
        inviteLink: string;
        inviterName: string;
        recipientEmail: string;
        recipientName: string;
        roleLabel: string;
        tenantName: string;
      };
    }
  | {
      kind: "reset-password";
      payload: {
        recipientEmail: string;
        recipientName: string;
        resetLink: string;
      };
    }
  | {
      kind: "site-action";
      payload: {
        contextLines: string[];
        ctaLabel: string;
        ctaPath: string;
        intro: string;
        recipientEmail: string;
        recipientName: string;
        subject: string;
        title: string;
      };
    };

export type PdfQueuePayload =
  | {
      kind: "report";
      payload: {
        reportId: string;
      };
    }
  | {
      kind: "invoice";
      payload: {
        invoiceId: string;
      };
    }
  | {
      kind: "statement";
      payload: {
        statementId: string;
      };
    }
  | {
      kind: "payment-receipt";
      payload: {
        paymentId: string;
      };
    };

export type ReminderQueuePayload = {
  context?: Record<string, unknown>;
  kind: "client-validation-pending" | "invoice-overdue" | "project-validation-pending";
  projectId: string;
};

export type DeferredWorkQueuePayload = {
  context?: Record<string, unknown>;
  kind: string;
  projectId?: string;
};
