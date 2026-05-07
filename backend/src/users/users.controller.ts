import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from "@nestjs/common";

import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { Roles } from "@/common/decorators/roles.decorator";
import { JwtAuthGuard } from "@/common/guards/jwt-auth.guard";
import { RolesGuard } from "@/common/guards/roles.guard";
import { AuthenticatedUser } from "@/common/types/authenticated-user.interface";
import { InviteUserDto } from "@/users/dto/invite-user.dto";
import { UpdateRoleDto } from "@/users/dto/update-role.dto";
import { UsersService } from "@/users/users.service";

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles("ADMIN")
  list(@CurrentUser() currentUser: AuthenticatedUser) {
    return this.usersService.list(currentUser);
  }

  @Post("invite")
  @Roles("ADMIN")
  invite(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() payload: InviteUserDto,
  ) {
    return this.usersService.invite(currentUser, payload);
  }

  @Get("me")
  me(@CurrentUser() currentUser: AuthenticatedUser) {
    return this.usersService.me(currentUser);
  }

  @Put(":id/role")
  @Roles("ADMIN")
  updateRole(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param("id") userId: string,
    @Body() payload: UpdateRoleDto,
  ) {
    return this.usersService.updateRole(currentUser, userId, payload);
  }

  @Delete(":id")
  @Roles("ADMIN")
  deactivate(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param("id") userId: string,
  ) {
    return this.usersService.deactivate(currentUser, userId);
  }
}
