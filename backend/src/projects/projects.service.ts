import { Injectable } from "@nestjs/common";

import { AddProjectMemberDto } from "@/projects/dto/add-project-member.dto";
import { CreateProjectDto } from "@/projects/dto/create-project.dto";

@Injectable()
export class ProjectsService {
  list() {
    return { items: [], mode: "scaffold" };
  }

  create(payload: CreateProjectDto) {
    return { mode: "scaffold", next: "create-project-and-bootstrap-context", payload };
  }

  detail(projectId: string) {
    return { mode: "scaffold", projectId };
  }

  members(projectId: string) {
    return { mode: "scaffold", projectId, items: [] };
  }

  addMember(projectId: string, payload: AddProjectMemberDto) {
    return { mode: "scaffold", next: "attach-project-member", projectId, payload };
  }
}
