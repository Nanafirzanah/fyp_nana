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
  UnlockResponse,
} from "../types";
import { getApiBaseUrl, authHeaders, handleResponse } from "./utils";
import type { EncryptedFile } from "../crypto/lockCrypto";

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

/**
 * Upload a file the browser has already encrypted. The body is ciphertext; only
 * the verifier and the public key-derivation parameters accompany it. The
 * password and the AES key are never sent.
 */
export async function uploadLockedDocument(
  idToken: string,
  file: File,
  encrypted: EncryptedFile,
  folderId?: string,
): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append(
    "file",
    new Blob([encrypted.ciphertext], { type: "application/octet-stream" }),
    file.name,
  );
  formData.append("verifier", encrypted.verifier);
  formData.append("kdf_salt", encrypted.params.salt);
  formData.append("kdf_iterations", String(encrypted.params.iterations));
  formData.append("iv", encrypted.params.iv);
  formData.append(
    "original_content_type",
    file.type || "application/octet-stream",
  );

  const url = new URL(`${getApiBaseUrl()}/documents/upload-locked`);
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

// UNLOCK

/**
 * Prove knowledge of the file password by sending its verifier (the password
 * itself is never sent). On success the server returns the ciphertext URL + IV.
 * Failures throw "<status>: <message>", e.g. "403: Invalid password. 4 attempt(s) left."
 */
export async function unlockDocument(
  idToken: string,
  fileId: string,
  verifier: string,
): Promise<UnlockResponse> {
  const response = await fetch(`${getApiBaseUrl()}/documents/${fileId}/unlock`, {
    method: "POST",
    headers: { ...authHeaders(idToken), "Content-Type": "application/json" },
    body: JSON.stringify({ verifier }),
  });
  return handleResponse<UnlockResponse>(response);
}
