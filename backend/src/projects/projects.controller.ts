import { Body, Controller, Get, Param, Post } from "@nestjs/common";

import { AddProjectMemberDto } from "@/projects/dto/add-project-member.dto";
import { CreateProjectDto } from "@/projects/dto/create-project.dto";
import { ProjectsService } from "@/projects/projects.service";

@Controller("projects")
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  list() {
    return this.projectsService.list();
  }

  @Post()
  create(@Body() payload: CreateProjectDto) {
    return this.projectsService.create(payload);
  }

  @Get(":id")
  detail(@Param("id") projectId: string) {
    return this.projectsService.detail(projectId);
  }

  @Get(":id/members")
  members(@Param("id") projectId: string) {
    return this.projectsService.members(projectId);
  }

  @Post(":id/members")
  addMember(
    @Param("id") projectId: string,
    @Body() payload: AddProjectMemberDto,
  ) {
    return this.projectsService.addMember(projectId, payload);
  }
}
