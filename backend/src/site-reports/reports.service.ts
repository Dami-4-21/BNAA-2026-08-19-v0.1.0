import { Injectable } from "@nestjs/common";

@Injectable()
export class ReportsService {
  list(projectId: string) {
    return { mode: "scaffold", projectId, items: [] };
  }
}
