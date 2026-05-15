import { Buffer } from "node:buffer";

import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Client as MinioClient } from "minio";

type BuildPresignedUploadPlanInput = {
  contentType?: string;
  expiresInSeconds?: number;
  fileKey?: string;
  filename: string;
};

type ReadStoredBufferInput = {
  fileKey?: string | null;
  fileUrl?: string | null;
};

type StoreBufferInput = {
  buffer: Buffer;
  fileKey: string;
  mimeType: string;
};

@Injectable()
export class StorageService {
  private readonly bucketName: string;
  private readonly client: MinioClient | null;

  constructor(private readonly configService: ConfigService) {
    const endPoint = this.configService.get<string>("MINIO_ENDPOINT")?.trim();
    const accessKey = this.configService.get<string>("MINIO_ACCESS_KEY")?.trim();
    const secretKey = this.configService.get<string>("MINIO_SECRET_KEY")?.trim();

    this.bucketName =
      this.configService.get<string>("MINIO_BUCKET")?.trim() || "bnaasaas";

    if (endPoint && accessKey && secretKey) {
      const port = Number(this.configService.get<string>("MINIO_PORT") ?? "9000");
      const useSSL =
        String(this.configService.get<string>("MINIO_USE_SSL") ?? "false").toLowerCase() ===
        "true";

      this.client = new MinioClient({
        accessKey,
        endPoint,
        port: Number.isFinite(port) ? port : 9000,
        secretKey,
        useSSL,
      });
      return;
    }

    this.client = null;
  }

  buildPresignedUploadPlan(input: BuildPresignedUploadPlanInput) {
    const fileKey = input.fileKey ?? sanitizeFileSegment(input.filename);
    return {
      bucket: this.bucketName,
      contentType: input.contentType ?? "application/octet-stream",
      expiresInSeconds: input.expiresInSeconds ?? 900,
      fileKey,
      filename: input.filename,
      mode: this.isManagedStorageEnabled() ? "managed" : "scaffold",
      next: this.isManagedStorageEnabled()
        ? "generate-minio-presigned-url"
        : "generate-minio-presigned-url",
    };
  }

  isManagedStorageEnabled() {
    return this.client !== null;
  }

  async storeBuffer(input: StoreBufferInput) {
    if (!this.client) {
      return {
        fileKey: input.fileKey,
        fileUrl: buildDataUrl(input.buffer, input.mimeType),
        storageMode: "inline" as const,
      };
    }

    await this.ensureBucket();
    await this.client.putObject(this.bucketName, input.fileKey, input.buffer, input.buffer.length, {
      "Content-Type": input.mimeType,
    });

    return {
      fileKey: input.fileKey,
      fileUrl: buildManagedUrl(this.bucketName, input.fileKey),
      storageMode: "managed" as const,
    };
  }

  async readStoredBuffer(input: ReadStoredBufferInput) {
    if (input.fileUrl && isDataUrl(input.fileUrl)) {
      return decodeDataUrlToBuffer(input.fileUrl);
    }

    const managedKey = input.fileKey ?? parseManagedUrl(input.fileUrl);
    if (managedKey && this.client) {
      await this.ensureBucket();
      const stream = await this.client.getObject(this.bucketName, managedKey);
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }

      return Buffer.concat(chunks);
    }

    if (input.fileUrl) {
      throw new Error("Unsupported managed file payload.");
    }

    throw new Error("Stored file is unavailable.");
  }

  private async ensureBucket() {
    if (!this.client) {
      return;
    }

    const exists = await this.client.bucketExists(this.bucketName);
    if (!exists) {
      await this.client.makeBucket(this.bucketName);
    }
  }
}

function buildManagedUrl(bucket: string, fileKey: string) {
  return `minio://${bucket}/${fileKey}`;
}

function parseManagedUrl(fileUrl: string | null | undefined) {
  const value = String(fileUrl ?? "");
  const match = /^minio:\/\/[^/]+\/(.+)$/i.exec(value);
  return match?.[1] ?? null;
}

function isDataUrl(value: string) {
  return /^data:[^;]+;base64,/i.test(value);
}

function decodeDataUrlToBuffer(dataUrl: string) {
  const match = /^data:([^;]+);base64,(.+)$/i.exec(dataUrl);
  if (!match?.[2]) {
    throw new Error("Unsupported inline file payload.");
  }

  return Buffer.from(match[2], "base64");
}

function buildDataUrl(buffer: Buffer, mimeType: string) {
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

function sanitizeFileSegment(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-");
}
