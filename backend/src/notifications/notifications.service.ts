import { Injectable } from "@nestjs/common";
import type { PoolClient } from "pg";

@Injectable()
export class NotificationsService {
  listForUser(userId: string) {
    return { mode: "scaffold", userId, items: [] };
  }

  async createForUsers(
    client: PoolClient,
    input: {
      userIds: string[];
      projectId?: string | null;
      type: string;
      title: string;
      body?: string | null;
      link?: string | null;
    },
  ) {
    const uniqueUserIds = [...new Set(input.userIds.filter(Boolean))];

    if (uniqueUserIds.length === 0) {
      return { inserted: 0 };
    }

    await client.query(
      `INSERT INTO notifications (user_id, project_id, type, title, body, link)
       SELECT user_id, $2, $3, $4, $5, $6
       FROM UNNEST($1::uuid[]) AS user_id`,
      [
        uniqueUserIds,
        input.projectId ?? null,
        input.type,
        input.title,
        input.body ?? null,
        input.link ?? null,
      ],
    );

    return {
      inserted: uniqueUserIds.length,
    };
  }

  async createForProjectRoles(
    client: PoolClient,
    input: {
      projectId: string;
      roles: string[];
      type: string;
      title: string;
      body?: string | null;
      link?: string | null;
      excludeUserIds?: string[];
    },
  ) {
    const result = await client.query<{ user_id: string }>(
      `SELECT DISTINCT pm.user_id
       FROM project_members pm
       WHERE pm.project_id = $1
         AND pm.role = ANY($2::text[])`,
      [input.projectId, input.roles],
    );

    const excluded = new Set(input.excludeUserIds ?? []);
    const userIds = result.rows
      .map((row) => row.user_id)
      .filter((userId) => !excluded.has(userId));

    return this.createForUsers(client, {
      userIds,
      projectId: input.projectId,
      type: input.type,
      title: input.title,
      body: input.body,
      link: input.link,
    });
  }
}
