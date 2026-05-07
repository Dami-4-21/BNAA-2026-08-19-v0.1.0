import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { Request, Response } from "express";

import { AcceptInviteDto } from "@/auth/dto/accept-invite.dto";
import { Disable2faDto } from "@/auth/dto/disable-2fa.dto";
import { Enable2faDto } from "@/auth/dto/enable-2fa.dto";
import { ForgotPasswordDto } from "@/auth/dto/forgot-password.dto";
import { LoginDto } from "@/auth/dto/login.dto";
import { RegisterDto } from "@/auth/dto/register.dto";
import { ResetPasswordDto } from "@/auth/dto/reset-password.dto";
import { Verify2faDto } from "@/auth/dto/verify-2fa.dto";
import { AuthService } from "@/auth/auth.service";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { AuthenticatedUser } from "@/common/types/authenticated-user.interface";
import { JwtAuthGuard } from "@/common/guards/jwt-auth.guard";
import { JwtRefreshGuard } from "@/common/guards/jwt-refresh.guard";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("register")
  async register(
    @Body() payload: RegisterDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const session = await this.authService.register(payload);
    response.cookie(
      "refreshToken",
      session.refreshToken,
      this.authService.getRefreshCookieOptions(),
    );

    return {
      ...session,
      refreshToken: undefined,
    };
  }

  @Post("login")
  async login(
    @Body() payload: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const session = await this.authService.login(payload);

    if ("refreshToken" in session) {
      response.cookie(
        "refreshToken",
        session.refreshToken,
        this.authService.getRefreshCookieOptions(),
      );

      return {
        ...session,
        refreshToken: undefined,
      };
    }

    return session;
  }

  @Post("2fa/verify")
  async verify2fa(
    @Body() payload: Verify2faDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const session = await this.authService.verify2fa(payload);
    response.cookie(
      "refreshToken",
      session.refreshToken,
      this.authService.getRefreshCookieOptions(),
    );

    return {
      ...session,
      refreshToken: undefined,
    };
  }

  @UseGuards(JwtRefreshGuard)
  @Post("refresh")
  async refresh(
    @Req() request: Request & { user: AuthenticatedUser },
    @Res({ passthrough: true }) response: Response,
  ) {
    const refreshToken = request.cookies?.refreshToken as string | undefined;
    const session = await this.authService.refreshSession(refreshToken ?? "", request.user);
    response.cookie(
      "refreshToken",
      session.refreshToken,
      this.authService.getRefreshCookieOptions(),
    );

    return {
      ...session,
      refreshToken: undefined,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post("logout")
  async logout(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Res({ passthrough: true }) response: Response,
  ) {
    response.clearCookie("refreshToken", this.authService.getRefreshCookieOptions());
    return this.authService.logout(currentUser);
  }

  @UseGuards(JwtAuthGuard)
  @Get("2fa/setup")
  setup2fa(@CurrentUser() currentUser: AuthenticatedUser) {
    return this.authService.setup2fa(currentUser);
  }

  @UseGuards(JwtAuthGuard)
  @Get("me")
  me(@CurrentUser() currentUser: AuthenticatedUser) {
    return this.authService.me(currentUser);
  }

  @UseGuards(JwtAuthGuard)
  @Post("2fa/enable")
  enable2fa(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() payload: Enable2faDto,
  ) {
    return this.authService.enable2fa(currentUser, payload);
  }

  @UseGuards(JwtAuthGuard)
  @Post("2fa/disable")
  disable2fa(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() payload: Disable2faDto,
  ) {
    return this.authService.disable2fa(currentUser, payload);
  }

  @Post("forgot-password")
  forgotPassword(@Body() payload: ForgotPasswordDto) {
    return this.authService.forgotPassword(payload.email);
  }

  @Post("reset-password")
  resetPassword(@Body() payload: ResetPasswordDto) {
    return this.authService.resetPassword(payload);
  }

  @Post("accept-invite")
  async acceptInvite(
    @Body() payload: AcceptInviteDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const session = await this.authService.acceptInvite(payload);
    response.cookie(
      "refreshToken",
      session.refreshToken,
      this.authService.getRefreshCookieOptions(),
    );

    return {
      ...session,
      refreshToken: undefined,
    };
  }
}
