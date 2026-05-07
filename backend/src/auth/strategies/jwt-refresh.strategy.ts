import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, "jwt-refresh") {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: { cookies?: Record<string, string> }) =>
          request?.cookies?.refreshToken ?? null,
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>("JWT_REFRESH_SECRET", "dev-refresh-secret"),
      passReqToCallback: true,
    });
  }

  validate(
    request: { cookies?: Record<string, string> },
    payload: Record<string, unknown>,
  ) {
    return {
      ...payload,
      refreshToken: request.cookies?.refreshToken,
    };
  }
}
