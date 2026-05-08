import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";

import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { Roles } from "@/common/decorators/roles.decorator";
import { JwtAuthGuard } from "@/common/guards/jwt-auth.guard";
import { RolesGuard } from "@/common/guards/roles.guard";
import { AuthenticatedUser } from "@/common/types/authenticated-user.interface";
import { CreatePhotoDto } from "@/site-reports/dto/create-photo.dto";
import { PhotosService } from "@/site-reports/photos.service";

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("projects/:id/photos")
export class PhotosController {
  constructor(private readonly photosService: PhotosService) {}

  @Get()
  list(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param("id") projectId: string,
    @Query("reportId") reportId?: string,
  ) {
    return this.photosService.list(currentUser, projectId, reportId);
  }

  @Post()
  @Roles("ADMIN", "CP", "CT")
  create(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param("id") projectId: string,
    @Body() payload: CreatePhotoDto,
  ) {
    return this.photosService.create(currentUser, projectId, payload);
  }
}
