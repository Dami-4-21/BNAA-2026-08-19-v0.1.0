import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Resend } from "resend";

type InviteEmailInput = {
  inviteLink: string;
  inviterName: string;
  recipientEmail: string;
  recipientName: string;
  roleLabel: string;
  tenantName: string;
};

type ResetPasswordEmailInput = {
  recipientEmail: string;
  recipientName: string;
  resetLink: string;
};

type SiteActionEmailInput = {
  contextLines: string[];
  ctaLabel: string;
  ctaPath: string;
  intro: string;
  recipientEmail: string;
  recipientName: string;
  subject: string;
  title: string;
};

type MailDeliveryResult = {
  mode: "debug" | "sent";
  messageId?: string;
};

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly resend: Resend | null;
  private readonly emailFrom: string;
  private readonly appUrl: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>("RESEND_API_KEY", "").trim();
    this.emailFrom = this.configService
      .get<string>("EMAIL_FROM", "noreply@bnaasaas.tn")
      .trim();
    this.appUrl = this.configService
      .get<string>("APP_URL", "http://localhost:3000")
      .replace(/\/+$/, "");
    this.resend = apiKey ? new Resend(apiKey) : null;
  }

  async sendInviteEmail(input: InviteEmailInput): Promise<MailDeliveryResult> {
    const subject = `Invitation BnaaSaaS - ${input.tenantName}`;
    const html = `
      <div style="font-family:Arial,sans-serif;color:#111;line-height:1.6">
        <h2 style="margin-bottom:8px">Invitation BnaaSaaS</h2>
        <p>Bonjour ${input.recipientName},</p>
        <p>${input.inviterName} vous a invite a rejoindre <strong>${input.tenantName}</strong> sur BnaaSaaS en tant que <strong>${input.roleLabel}</strong>.</p>
        <p><a href="${input.inviteLink}" style="display:inline-block;padding:12px 18px;background:#111;color:#fff;text-decoration:none;border-radius:10px">Activer mon acces</a></p>
        <p>Si le bouton ne fonctionne pas, utilisez ce lien :</p>
        <p><a href="${input.inviteLink}">${input.inviteLink}</a></p>
      </div>
    `;

    return this.sendEmail({
      html,
      recipientEmail: input.recipientEmail,
      subject,
    });
  }

  async sendResetPasswordEmail(
    input: ResetPasswordEmailInput,
  ): Promise<MailDeliveryResult> {
    const subject = "Reinitialisation de votre mot de passe BnaaSaaS";
    const html = `
      <div style="font-family:Arial,sans-serif;color:#111;line-height:1.6">
        <h2 style="margin-bottom:8px">Reinitialisation du mot de passe</h2>
        <p>Bonjour ${input.recipientName},</p>
        <p>Une demande de reinitialisation de mot de passe a ete recue pour votre compte BnaaSaaS.</p>
        <p><a href="${input.resetLink}" style="display:inline-block;padding:12px 18px;background:#111;color:#fff;text-decoration:none;border-radius:10px">Definir un nouveau mot de passe</a></p>
        <p>Si vous n'etes pas a l'origine de cette demande, vous pouvez ignorer cet email.</p>
        <p>Lien direct :</p>
        <p><a href="${input.resetLink}">${input.resetLink}</a></p>
      </div>
    `;

    return this.sendEmail({
      html,
      recipientEmail: input.recipientEmail,
      subject,
    });
  }

  buildInviteLink(token: string) {
    return `${this.appUrl}/accept-invite?token=${encodeURIComponent(token)}`;
  }

  buildResetPasswordLink(token: string) {
    return `${this.appUrl}/reset-password?token=${encodeURIComponent(token)}`;
  }

  buildAppLink(path: string) {
    return `${this.appUrl}${path.startsWith("/") ? path : `/${path}`}`;
  }

  async sendReportSubmittedEmail(input: {
    projectName: string;
    recipientEmail: string;
    recipientName: string;
    reportDate: string;
    reportLink: string;
  }) {
    return this.sendSiteActionEmail({
      recipientEmail: input.recipientEmail,
      recipientName: input.recipientName,
      subject: `RJC a valider - ${input.projectName}`,
      title: "Rapport journalier soumis",
      intro: "Un rapport journalier est pret pour signature sur votre projet.",
      ctaLabel: "Ouvrir le rapport",
      ctaPath: input.reportLink,
      contextLines: [
        `Projet : ${input.projectName}`,
        `Date du rapport : ${input.reportDate}`,
      ],
    });
  }

  async sendReportSignedEmail(input: {
    projectName: string;
    recipientEmail: string;
    recipientName: string;
    reportDate: string;
    reportLink: string;
  }) {
    return this.sendSiteActionEmail({
      recipientEmail: input.recipientEmail,
      recipientName: input.recipientName,
      subject: `RJC signe - ${input.projectName}`,
      title: "Rapport journalier signe",
      intro: "Le rapport journalier a ete signe et archive.",
      ctaLabel: "Consulter le rapport",
      ctaPath: input.reportLink,
      contextLines: [
        `Projet : ${input.projectName}`,
        `Date du rapport : ${input.reportDate}`,
      ],
    });
  }

  async sendNcrAssignedEmail(input: {
    deadline?: string | null;
    ncrLink: string;
    projectName: string;
    recipientEmail: string;
    recipientName: string;
    reference: string;
    title: string;
  }) {
    return this.sendSiteActionEmail({
      recipientEmail: input.recipientEmail,
      recipientName: input.recipientName,
      subject: `NC assignee - ${input.reference}`,
      title: "Non-conformite assignee",
      intro: "Une non-conformite vous a ete attribuee sur chantier.",
      ctaLabel: "Ouvrir la NC",
      ctaPath: input.ncrLink,
      contextLines: [
        `Projet : ${input.projectName}`,
        `Reference : ${input.reference}`,
        `Intitule : ${input.title}`,
        ...(input.deadline ? [`Delai : ${input.deadline}`] : []),
      ],
    });
  }

  async sendNcrClosedEmail(input: {
    ncrLink: string;
    projectName: string;
    recipientEmail: string;
    recipientName: string;
    reference: string;
    title: string;
  }) {
    return this.sendSiteActionEmail({
      recipientEmail: input.recipientEmail,
      recipientName: input.recipientName,
      subject: `NC cloturee - ${input.reference}`,
      title: "Non-conformite cloturee",
      intro: "La non-conformite a ete cloturee avec piece justificative.",
      ctaLabel: "Voir la NC",
      ctaPath: input.ncrLink,
      contextLines: [
        `Projet : ${input.projectName}`,
        `Reference : ${input.reference}`,
        `Intitule : ${input.title}`,
      ],
    });
  }

  private async sendEmail(input: {
    html: string;
    recipientEmail: string;
    subject: string;
  }): Promise<MailDeliveryResult> {
    if (!this.resend) {
      this.logger.warn(
        `No RESEND_API_KEY configured. Email for "${input.subject}" captured in debug mode for ${input.recipientEmail}.`,
      );

      return {
        mode: "debug",
      };
    }

    const result = await this.resend.emails.send({
      from: this.emailFrom,
      to: input.recipientEmail,
      subject: input.subject,
      html: input.html,
    });

    return {
      mode: "sent",
      messageId: result.data?.id,
    };
  }

  private async sendSiteActionEmail(input: SiteActionEmailInput) {
    const ctaLink = this.buildAppLink(input.ctaPath);
    const contextBlock = input.contextLines
      .map((line) => `<li style="margin-bottom:4px">${line}</li>`)
      .join("");

    const html = `
      <div style="font-family:Arial,sans-serif;color:#111;line-height:1.6">
        <div style="font-size:12px;letter-spacing:0.12em;text-transform:uppercase;margin-bottom:12px">BnaaSaaS</div>
        <h2 style="margin-bottom:8px">${input.title}</h2>
        <p>Bonjour ${input.recipientName},</p>
        <p>${input.intro}</p>
        <ul style="padding-left:18px;margin:12px 0 18px">${contextBlock}</ul>
        <p><a href="${ctaLink}" style="display:inline-block;padding:12px 18px;background:#111;color:#fff;text-decoration:none;border-radius:10px">${input.ctaLabel}</a></p>
        <p>Si le bouton ne fonctionne pas, utilisez ce lien :</p>
        <p><a href="${ctaLink}">${ctaLink}</a></p>
      </div>
    `;

    return this.sendEmail({
      html,
      recipientEmail: input.recipientEmail,
      subject: input.subject,
    });
  }
}
