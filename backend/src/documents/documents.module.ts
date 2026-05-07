import { Module } from "@nestjs/common";

import { DistributionService } from "@/documents/distribution.service";
import { DocumentsController } from "@/documents/documents.controller";
import { DocumentsService } from "@/documents/documents.service";
import { VersionsService } from "@/documents/versions.service";

@Module({
  controllers: [DocumentsController],
  providers: [DocumentsService, VersionsService, DistributionService],
})
export class DocumentsModule {}
