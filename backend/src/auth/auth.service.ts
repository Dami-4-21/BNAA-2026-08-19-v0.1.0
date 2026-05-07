import { Injectable } from "@nestjs/common";

import { AcceptInviteDto } from "@/auth/dto/accept-invite.dto";
import { LoginDto } from "@/auth/dto/login.dto";
import { RegisterDto } from "@/auth/dto/register.dto";
import { ResetPasswordDto } from "@/auth/dto/reset-password.dto";
import { Verify2faDto } from "@/auth/dto/verify-2fa.dto";

@Injectable()
export class AuthService {
  register(payload: RegisterDto) {
    return {
      mode: "scaffold",
      next: "create-tenant-and-seed-admin",
      payload,
    };
  }

  login(payload: LoginDto) {
    return {
      mode: "scaffold",
      next: "validate-password-and-issue-jwt",
      payload,
    };
  }

  verify2fa(payload: Verify2faDto) {
    return {
      mode: "scaffold",
      next: "validate-totp-and-issue-access-token",
      payload,
    };
  }

  refresh() {
    return {
      mode: "scaffold",
      next: "rotate-refresh-token",
    };
  }

  logout() {
    return { ok: true };
  }

  forgotPassword(email: string) {
    return {
      mode: "scaffold",
      next: "queue-reset-email",
      email,
    };
  }

  resetPassword(payload: ResetPasswordDto) {
    return {
      mode: "scaffold",
      next: "set-new-password-hash",
      payload,
    };
  }

  acceptInvite(payload: AcceptInviteDto) {
    return {
      mode: "scaffold",
      next: "activate-user-from-invite",
      payload,
    };
  }

  setup2fa() {
    return {
      mode: "scaffold",
      next: "generate-totp-secret-and-qr",
    };
  }
}
