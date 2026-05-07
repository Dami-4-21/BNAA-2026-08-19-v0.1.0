import { Module } from "@nestjs/common";

import { DatabaseModule } from "@/database/database.module";
import { MailModule } from "@/mail/mail.module";
import { UsersController } from "@/users/users.controller";
import { UsersService } from "@/users/users.service";

@Module({
  imports: [DatabaseModule, MailModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
