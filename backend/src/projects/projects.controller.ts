import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";

import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { Roles } from "@/common/decorators/roles.decorator";
import { JwtAuthGuard } from "@/common/guards/jwt-auth.guard";
import { RolesGuard } from "@/common/guards/roles.guard";
import { AuthenticatedUser } from "@/common/types/authenticated-user.interface";
import { AddProjectMemberDto } from "@/projects/dto/add-project-member.dto";
import { CreateProjectDto } from "@/projects/dto/create-project.dto";
import { ProjectsService } from "@/projects/projects.service";

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("projects")
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  list(@CurrentUser() currentUser: AuthenticatedUser) {
    return this.projectsService.list(currentUser);
  }

  @Post()
  @Roles("ADMIN", "CP")
  create(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() payload: CreateProjectDto,
  ) {
    return this.projectsService.create(currentUser, payload);
  }

  @Get(":id")
  detail(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param("id") projectId: string,
  ) {
    return this.projectsService.detail(currentUser, projectId);
  }

  @Get(":id/members")
  members(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param("id") projectId: string,
  ) {
    return this.projectsService.members(currentUser, projectId);
  }

  @Post(":id/members")
  @Roles("ADMIN", "CP")
  addMember(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param("id") projectId: string,
    @Body() payload: AddProjectMemberDto,
  ) {
    return this.projectsService.addMember(currentUser, projectId, payload);
  }
}
