import { Buffer } from "node:buffer";

import type { DocumentsModuleData } from "@/lib/backend/types";
import { getRebuildApiUrl, resolveRebuildProjectForLegacyId } from "@/lib/rebuild-auth";

type PublishDocumentVersionInput = {
  documentId: string;
  file: File;
  format: string;
  revision: string;
};

type RebuildBinaryAsset = {
  bytes: ArrayBuffer;
  fileName: string;
  mimeType: string;
};

type DocumentMutationAction =
  | "acknowledge"
  | "distribute"
  | "mark-obsolete"
  | "toggle-offline"
  | "update-metadata";

export function shouldUseRebuildDocumentsBridge() {
  return process.env.BNAASAAS_REBUILD_DOCUMENTS_ENABLED === "true";
}

export async function buildRebuildDocumentsPayload(
  accessToken: string,
  legacyProjectId: string,
) {
  const resolvedProject = await resolveRebuildProjectForLegacyId(accessToken, legacyProjectId);
  if (!resolvedProject) {
    return null;
  }

  const payload = await callRebuildJson<DocumentsModuleData>(
    `/api/v1/projects/${resolvedProject.id}/documents`,
    accessToken,
  );

  return payload
    ? rewriteDocumentsPayloadUrls(payload, {
        legacyProjectId,
        rebuildProjectId: resolvedProject.id,
      })
    : null;
}

export async function publishRebuildDocumentVersion(
  accessToken: string,
  legacyProjectId: string,
  input: PublishDocumentVersionInput,
) {
  const resolvedProject = await resolveRebuildProjectForLegacyId(accessToken, legacyProjectId);
  if (!resolvedProject) {
    return null;
  }

  const fileBuffer = Buffer.from(await input.file.arrayBuffer());

  return callRebuildJson<DocumentsModuleData>(
    `/api/v1/projects/${resolvedProject.id}/documents/${encodeURIComponent(input.documentId)}/versions`,
    accessToken,
    {
      method: "POST",
      body: JSON.stringify({
        fileBase64: fileBuffer.toString("base64"),
        fileName: input.file.name,
        format: input.format,
        mimeType: input.file.type || inferMimeTypeFromFileName(input.file.name),
        revision: input.revision,
      }),
      headers: {
        "Content-Type": "application/json",
      },
    },
  );
}

export async function mutateRebuildDocumentsPayload(
  accessToken: string,
  legacyProjectId: string,
  action: DocumentMutationAction,
  payload: Record<string, unknown>,
) {
  const resolvedProject = await resolveRebuildProjectForLegacyId(accessToken, legacyProjectId);
  if (!resolvedProject) {
    return null;
  }

  switch (action) {
    case "update-metadata":
      return callRebuildJson<DocumentsModuleData>(
        `/api/v1/projects/${resolvedProject.id}/documents/${encodeURIComponent(String(payload.documentId ?? ""))}`,
        accessToken,
        {
          method: "PUT",
          body: JSON.stringify({
            discipline: String(payload.discipline ?? ""),
            lot: String(payload.lot ?? ""),
            phase: String(payload.phase ?? ""),
            title: String(payload.title ?? ""),
          }),
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    case "mark-obsolete":
      return callRebuildJson<DocumentsModuleData>(
        `/api/v1/projects/${resolvedProject.id}/documents/${encodeURIComponent(String(payload.documentId ?? ""))}/obsolete`,
        accessToken,
        {
          method: "POST",
        },
      );
    case "distribute":
      return callRebuildJson<DocumentsModuleData>(
        `/api/v1/projects/${resolvedProject.id}/documents/${encodeURIComponent(String(payload.documentId ?? ""))}/distribute`,
        accessToken,
        {
          method: "POST",
          body: JSON.stringify({
            audience: String(payload.audience ?? ""),
          }),
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    case "acknowledge":
      return callRebuildJson<DocumentsModuleData>(
        `/api/v1/projects/${resolvedProject.id}/documents/${encodeURIComponent(String(payload.documentId ?? ""))}/acknowledge`,
        accessToken,
        {
          method: "POST",
          body: JSON.stringify({
            recipientId: String(payload.recipientId ?? ""),
          }),
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    case "toggle-offline":
      return callRebuildJson<DocumentsModuleData>(
        `/api/v1/projects/${resolvedProject.id}/documents/${encodeURIComponent(String(payload.documentId ?? ""))}/offline`,
        accessToken,
        {
          method: "POST",
        },
      );
    default:
      return null;
  }
}

export async function downloadRebuildDocumentFile(
  accessToken: string,
  legacyProjectId: string,
  documentId: string,
) {
  const resolvedProject = await resolveRebuildProjectForLegacyId(accessToken, legacyProjectId);
  if (!resolvedProject) {
    return null;
  }

  return callRebuildBinary(
    `/api/v1/projects/${resolvedProject.id}/documents/${encodeURIComponent(documentId)}/file`,
    accessToken,
  );
}

export async function downloadRebuildDocumentVersionFile(
  accessToken: string,
  legacyProjectId: string,
  documentId: string,
  versionId: string,
) {
  const resolvedProject = await resolveRebuildProjectForLegacyId(accessToken, legacyProjectId);
  if (!resolvedProject) {
    return null;
  }

  return callRebuildBinary(
    `/api/v1/projects/${resolvedProject.id}/documents/${encodeURIComponent(documentId)}/versions/${encodeURIComponent(versionId)}/file`,
    accessToken,
  );
}

async function callRebuildJson<T>(
  path: string,
  accessToken: string,
  options?: RequestInit,
): Promise<T | null> {
  const apiUrl = getRebuildApiUrl();
  if (!apiUrl || !accessToken) {
    return null;
  }

  try {
    const response = await fetch(`${apiUrl}${path}`, {
      ...options,
      cache: "no-store",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
        ...(options?.headers ?? {}),
      },
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as T;
  } catch {
    return null;
  }
}

async function callRebuildBinary(
  path: string,
  accessToken: string,
): Promise<RebuildBinaryAsset | null> {
  const apiUrl = getRebuildApiUrl();
  if (!apiUrl || !accessToken) {
    return null;
  }

  try {
    const response = await fetch(`${apiUrl}${path}`, {
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      return null;
    }

    return {
      bytes: await response.arrayBuffer(),
      fileName: parseFileName(response.headers.get("content-disposition")) ?? "document",
      mimeType: response.headers.get("content-type") ?? "application/octet-stream",
    };
  } catch {
    return null;
  }
}

function parseFileName(contentDisposition: string | null) {
  const match = /filename="?([^"]+)"?/i.exec(contentDisposition ?? "");
  return match?.[1] ?? null;
}

function inferMimeTypeFromFileName(fileName: string) {
  const extension = fileName.split(".").pop()?.toLowerCase();

  switch (extension) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "xlsx":
      return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    case "doc":
    case "docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case "dwg":
      return "application/acad";
    case "pdf":
    default:
      return "application/pdf";
  }
}

function rewriteDocumentsPayloadUrls(
  payload: DocumentsModuleData,
  context: { legacyProjectId: string; rebuildProjectId: string },
) {
  const replaceUrl = (value: string | undefined) =>
    value?.replace(
      `/api/v1/projects/${context.rebuildProjectId}/documents/`,
      `/api/projects/${context.legacyProjectId}/documents/`,
    );

  return {
    ...payload,
    files: payload.files.map((document) => ({
      ...document,
      downloadUrl: replaceUrl(document.downloadUrl),
      attachments: document.attachments?.map((attachment) => ({
        ...attachment,
        href: replaceUrl(attachment.href),
      })),
      relatedPhotos: document.relatedPhotos?.map((attachment) => ({
        ...attachment,
        href: replaceUrl(attachment.href),
      })),
      versions: document.versions.map((version) => ({
        ...version,
        downloadUrl: replaceUrl(version.downloadUrl),
      })),
    })),
  } satisfies DocumentsModuleData;
}
