import { Body, Controller, Delete, Get, Param, Post, Put } from "@nestjs/common";

import { InviteUserDto } from "@/users/dto/invite-user.dto";
import { UpdateRoleDto } from "@/users/dto/update-role.dto";
import { UsersService } from "@/users/users.service";

@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  list() {
    return this.usersService.list();
  }

  @Post("invite")
  invite(@Body() payload: InviteUserDto) {
    return this.usersService.invite(payload);
  }

  @Get("me")
  me() {
    return this.usersService.me();
  }

  @Put(":id/role")
  updateRole(@Param("id") userId: string, @Body() payload: UpdateRoleDto) {
    return this.usersService.updateRole(userId, payload);
  }

  @Delete(":id")
  deactivate(@Param("id") userId: string) {
    return this.usersService.deactivate(userId);
  }
}
