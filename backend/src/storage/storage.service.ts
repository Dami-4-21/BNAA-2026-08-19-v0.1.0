import { Injectable } from "@nestjs/common";

@Injectable()
export class StorageService {
  buildPresignedUploadPlan(filename: string) {
    return {
      expiresInSeconds: 900,
      filename,
      mode: "scaffold",
      next: "generate-minio-presigned-url",
    };
  }
}
