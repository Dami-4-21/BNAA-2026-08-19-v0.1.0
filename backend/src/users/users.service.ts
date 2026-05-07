import { Injectable } from "@nestjs/common";

import { InviteUserDto } from "@/users/dto/invite-user.dto";
import { UpdateRoleDto } from "@/users/dto/update-role.dto";

@Injectable()
export class UsersService {
  list() {
    return { items: [], mode: "scaffold" };
  }

  invite(payload: InviteUserDto) {
    return { mode: "scaffold", next: "create-inactive-user-and-send-invite", payload };
  }

  me() {
    return { mode: "scaffold", next: "return-profile" };
  }

  updateRole(userId: string, payload: UpdateRoleDto) {
    return { mode: "scaffold", next: "persist-role-change", userId, payload };
  }

  deactivate(userId: string) {
    return { mode: "scaffold", next: "soft-deactivate-user", userId };
  }
}
