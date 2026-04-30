import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { getDataDirectory } from "@/lib/backend/store";

const uploadsRoot = path.join(getDataDirectory(), "uploads");

const fallbackExtensionByMimeType: Record<string, string> = {
  "application/msword": ".doc",
  "application/pdf": ".pdf",
  "application/vnd.ms-excel": ".xls",
  "application/vnd.ms-powerpoint": ".ppt",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": ".pptx",
  "image/gif": ".gif",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "model/ifc": ".ifc",
  "text/plain": ".txt",
  "video/mp4": ".mp4",
};

function sanitizeSegment(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function inferExtension(originalName: string, mimeType: string) {
  const fromName = path.extname(originalName).toLowerCase();
  if (fromName) {
    return fromName;
  }

  return fallbackExtensionByMimeType[mimeType] ?? "";
}

function getAbsoluteUploadPath(relativePath: string) {
  const base = path.resolve(getDataDirectory());
  const candidate = path.resolve(base, relativePath);
  const relative = path.relative(base, candidate);

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Chemin de fichier invalide.");
  }

  return candidate;
}

export async function saveUploadedFile(options: {
  bytes: Uint8Array;
  mimeType: string;
  originalName: string;
  projectId: string;
  segments: string[];
  storedName: string;
}) {
  const extension = inferExtension(options.originalName, options.mimeType);
  const fileName = `${sanitizeSegment(options.storedName) || "fichier"}${extension}`;
  const relativePath = path
    .join(
      "uploads",
      "projects",
      sanitizeSegment(options.projectId) || options.projectId,
      ...options.segments.map((segment) => sanitizeSegment(segment) || "asset"),
      fileName,
    )
    .replace(/\\/g, "/");
  const absolutePath = getAbsoluteUploadPath(relativePath);

  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, Buffer.from(options.bytes));

  return {
    relativePath,
    fileName: options.originalName,
    fileSizeMb: Number((options.bytes.byteLength / (1024 * 1024)).toFixed(2)),
    mimeType: options.mimeType || "application/octet-stream",
  };
}

export async function readUploadedFile(relativePath: string) {
  return readFile(getAbsoluteUploadPath(relativePath));
}

export function getUploadsRoot() {
  return uploadsRoot;
}
