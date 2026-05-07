import { Module } from "@nestjs/common";

import { DatabaseModule } from "@/database/database.module";
import { UsersController } from "@/users/users.controller";
import { UsersService } from "@/users/users.service";

@Module({
  imports: [DatabaseModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
