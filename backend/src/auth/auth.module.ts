import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";

import { AuthController } from "@/auth/auth.controller";
import { AuthService } from "@/auth/auth.service";
import { JwtRefreshStrategy } from "@/auth/strategies/jwt-refresh.strategy";
import { JwtStrategy } from "@/auth/strategies/jwt.strategy";
import { TenantsModule } from "@/tenants/tenants.module";

@Module({
  imports: [ConfigModule, PassportModule, JwtModule.register({}), TenantsModule],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, JwtRefreshStrategy],
  exports: [AuthService],
})
export class AuthModule {}
