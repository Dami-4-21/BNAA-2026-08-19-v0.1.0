import { Body, Controller, Get, Post } from "@nestjs/common";

import { AcceptInviteDto } from "@/auth/dto/accept-invite.dto";
import { LoginDto } from "@/auth/dto/login.dto";
import { RegisterDto } from "@/auth/dto/register.dto";
import { ResetPasswordDto } from "@/auth/dto/reset-password.dto";
import { Verify2faDto } from "@/auth/dto/verify-2fa.dto";
import { AuthService } from "@/auth/auth.service";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("register")
  register(@Body() payload: RegisterDto) {
    return this.authService.register(payload);
  }

  @Post("login")
  login(@Body() payload: LoginDto) {
    return this.authService.login(payload);
  }

  @Post("2fa/verify")
  verify2fa(@Body() payload: Verify2faDto) {
    return this.authService.verify2fa(payload);
  }

  @Post("refresh")
  refresh() {
    return this.authService.refresh();
  }

  @Post("logout")
  logout() {
    return this.authService.logout();
  }

  @Get("2fa/setup")
  setup2fa() {
    return this.authService.setup2fa();
  }

  @Post("forgot-password")
  forgotPassword(@Body("email") email: string) {
    return this.authService.forgotPassword(email);
  }

  @Post("reset-password")
  resetPassword(@Body() payload: ResetPasswordDto) {
    return this.authService.resetPassword(payload);
  }

  @Post("accept-invite")
  acceptInvite(@Body() payload: AcceptInviteDto) {
    return this.authService.acceptInvite(payload);
  }
}
