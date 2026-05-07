import { Injectable } from "@nestjs/common";

@Injectable()
export class NotificationsService {
  listForUser(userId: string) {
    return { mode: "scaffold", userId, items: [] };
  }
}
