import {
  Body,
  Controller,
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
import { CloseNcrDto } from "@/site-reports/dto/close-ncr.dto";
import { CreateNcrDto } from "@/site-reports/dto/create-ncr.dto";
import { UpdateNcrDto } from "@/site-reports/dto/update-ncr.dto";
import { NcrService } from "@/site-reports/ncr.service";

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("projects/:id/ncr")
export class NcrController {
  constructor(private readonly ncrService: NcrService) {}

  @Get()
  list(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param("id") projectId: string,
  ) {
    return this.ncrService.list(currentUser, projectId);
  }

  @Get(":ncrId")
  detail(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param("id") projectId: string,
    @Param("ncrId") ncrId: string,
  ) {
    return this.ncrService.detail(currentUser, projectId, ncrId);
  }

  @Post()
  @Roles("ADMIN", "CP", "CT")
  create(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param("id") projectId: string,
    @Body() payload: CreateNcrDto,
  ) {
    return this.ncrService.create(currentUser, projectId, payload);
  }

  @Put(":ncrId")
  @Roles("ADMIN", "CP", "CT")
  update(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param("id") projectId: string,
    @Param("ncrId") ncrId: string,
    @Body() payload: UpdateNcrDto,
  ) {
    return this.ncrService.update(currentUser, projectId, ncrId, payload);
  }

  @Put(":ncrId/close")
  @Roles("ADMIN", "CP", "CT")
  close(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param("id") projectId: string,
    @Param("ncrId") ncrId: string,
    @Body() payload: CloseNcrDto,
  ) {
    return this.ncrService.close(currentUser, projectId, ncrId, payload);
  }
}
