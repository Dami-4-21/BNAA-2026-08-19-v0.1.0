import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  Res,
  StreamableFile,
  UseGuards,
} from "@nestjs/common";
import type { Response } from "express";

import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { Roles } from "@/common/decorators/roles.decorator";
import { JwtAuthGuard } from "@/common/guards/jwt-auth.guard";
import { RolesGuard } from "@/common/guards/roles.guard";
import { AuthenticatedUser } from "@/common/types/authenticated-user.interface";
import { AcknowledgeDocumentDto } from "@/documents/dto/acknowledge-document.dto";
import { DistributeDocumentDto } from "@/documents/dto/distribute-document.dto";
import { PublishVersionDto } from "@/documents/dto/publish-version.dto";
import { UpdateDocumentDto } from "@/documents/dto/update-document.dto";
import { DocumentsService } from "@/documents/documents.service";

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("projects/:id/documents")
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get()
  list(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param("id") projectId: string,
  ) {
    return this.documentsService.list(currentUser, projectId);
  }

  @Get("search")
  search(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param("id") projectId: string,
    @Query("q") query = "",
  ) {
    return this.documentsService.search(currentUser, projectId, query);
  }

  @Get(":documentId")
  detail(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param("id") projectId: string,
    @Param("documentId") documentId: string,
  ) {
    return this.documentsService.detail(currentUser, projectId, documentId);
  }

  @Get(":documentId/compare")
  compare(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param("id") projectId: string,
    @Param("documentId") documentId: string,
  ) {
    return this.documentsService.compare(currentUser, projectId, documentId);
  }

  @Get(":documentId/file")
  async download(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param("id") projectId: string,
    @Param("documentId") documentId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const asset = await this.documentsService.downloadDocument(currentUser, projectId, documentId);
    response.setHeader("Content-Type", asset.mimeType);
    response.setHeader(
      "Content-Disposition",
      `attachment; filename="${asset.fileName.replaceAll('"', "")}"`,
    );
    return new StreamableFile(asset.buffer);
  }

  @Get(":documentId/versions/:versionLabel/file")
  async downloadVersion(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param("id") projectId: string,
    @Param("documentId") documentId: string,
    @Param("versionLabel") versionLabel: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const asset = await this.documentsService.downloadDocumentVersion(
      currentUser,
      projectId,
      documentId,
      decodeURIComponent(versionLabel),
    );
    response.setHeader("Content-Type", asset.mimeType);
    response.setHeader(
      "Content-Disposition",
      `attachment; filename="${asset.fileName.replaceAll('"', "")}"`,
    );
    return new StreamableFile(asset.buffer);
  }

  @Post(":documentId/versions")
  @Roles("ADMIN", "BE")
  publishVersion(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param("id") projectId: string,
    @Param("documentId") documentId: string,
    @Body() payload: PublishVersionDto,
  ) {
    return this.documentsService.publishVersion(currentUser, projectId, documentId, payload);
  }

  @Put(":documentId")
  @Roles("ADMIN", "BE")
  updateMetadata(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param("id") projectId: string,
    @Param("documentId") documentId: string,
    @Body() payload: UpdateDocumentDto,
  ) {
    return this.documentsService.updateMetadata(currentUser, projectId, documentId, payload);
  }

  @Post(":documentId/obsolete")
  @Roles("ADMIN", "BE")
  markObsolete(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param("id") projectId: string,
    @Param("documentId") documentId: string,
  ) {
    return this.documentsService.markObsolete(currentUser, projectId, documentId);
  }

  @Post(":documentId/distribute")
  @Roles("ADMIN", "BE", "CP")
  distribute(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param("id") projectId: string,
    @Param("documentId") documentId: string,
    @Body() payload: DistributeDocumentDto,
  ) {
    return this.documentsService.distribute(currentUser, projectId, documentId, payload);
  }

  @Post(":documentId/acknowledge")
  acknowledge(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param("id") projectId: string,
    @Param("documentId") documentId: string,
    @Body() payload: AcknowledgeDocumentDto,
  ) {
    return this.documentsService.acknowledge(currentUser, projectId, documentId, payload);
  }

  @Post(":documentId/offline")
  toggleOffline(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param("id") projectId: string,
    @Param("documentId") documentId: string,
  ) {
    return this.documentsService.toggleOffline(currentUser, projectId, documentId);
  }
}
