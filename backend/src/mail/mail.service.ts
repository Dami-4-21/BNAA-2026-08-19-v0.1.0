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
}
