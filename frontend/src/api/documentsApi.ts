/**
 * API client for doc management endpoints
 * All calls attach the Cognito ID token as Bearer header.
 * Base URL comes from the vite api base url env var
 */

import type {
  DocumentListResponse,
  DownloadResponse,
  MoveResponse,
  UploadResponse,
} from "../types";
import { getApiBaseUrl, authHeaders, handleResponse } from "./utils";

// UPLOAD

export async function uploadDocument(
  idToken: string,
  file: File,
  folderId?: string,
): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const url = new URL(`${getApiBaseUrl()}/documents/upload`);
  if (folderId) url.searchParams.set("folder_id", folderId);

  const response = await fetch(url.toString(), {
    method: "POST",
    headers: authHeaders(idToken),
    body: formData,
  });
  return handleResponse<UploadResponse>(response);
}

// LIST

export async function listDocuments(
  idToken: string,
  folderId?: string,
  flat?: boolean,
): Promise<DocumentListResponse> {
  const url = new URL(`${getApiBaseUrl()}/documents/list`);
  if (folderId) url.searchParams.set("folder_id", folderId);
  if (flat) url.searchParams.set("flat", "true");

  const response = await fetch(url.toString(), {
    headers: authHeaders(idToken),
  });
  return handleResponse<DocumentListResponse>(response);
}

// DOWNLOAD

export async function getDownloadUrl(
  idToken: string,
  fileId: string,
): Promise<DownloadResponse> {
  const response = await fetch(
    `${getApiBaseUrl()}/documents/download/${fileId}`,
    {
      headers: authHeaders(idToken),
    },
  );
  return handleResponse<DownloadResponse>(response);
}

// RENAME

export async function renameDocument(
  idToken: string,
  fileId: string,
  name: string,
): Promise<{ file_id: string; display_name: string }> {
  const response = await fetch(
    `${getApiBaseUrl()}/documents/${fileId}/rename`,
    {
      method: "PATCH",
      headers: {
        ...authHeaders(idToken),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name }),
    },
  );
  return handleResponse(response);
}

// DELETE

export async function deleteDocument(
  idToken: string,
  fileId: string,
): Promise<{ file_id: string; deleted: boolean }> {
  const response = await fetch(`${getApiBaseUrl()}/documents/${fileId}`, {
    method: "DELETE",
    headers: authHeaders(idToken),
  });
  return handleResponse(response);
}

// MOVE

export async function moveItems(
  idToken: string,
  fileIds: string[],
  folderIds: string[],
  destinationFolderId: string | null,
): Promise<MoveResponse> {
  const response = await fetch(`${getApiBaseUrl()}/documents/move`, {
    method: "POST",
    headers: {
      ...authHeaders(idToken),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      file_ids: fileIds,
      folder_ids: folderIds,
      destination_folder_id: destinationFolderId,
    }),
  });
  return handleResponse<MoveResponse>(response);
}
