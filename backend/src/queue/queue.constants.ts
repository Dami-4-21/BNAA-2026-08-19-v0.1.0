export const QUEUE_NAMES = {
  deferred: "deferred-work",
  email: "email",
  pdf: "pdf",
  reminder: "reminder",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export const EMAIL_JOB_TYPES = {
  invite: "invite-email",
  resetPassword: "reset-password-email",
  siteAction: "site-action-email",
} as const;

export const PDF_JOB_TYPES = {
  invoice: "invoice-pdf",
  paymentReceipt: "payment-receipt-pdf",
  report: "report-pdf",
  statement: "statement-pdf",
} as const;

export const REMINDER_JOB_TYPES = {
  invoiceOverdue: "invoice-overdue-reminder",
  projectValidationPending: "project-validation-pending",
  clientValidationPending: "client-validation-pending",
} as const;
