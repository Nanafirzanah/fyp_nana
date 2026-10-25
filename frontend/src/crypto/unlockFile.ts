/**
 * Unlock a locked file: prove the password to the server (verifier only),
 * fetch the ciphertext, and decrypt it in the browser.
 *
 * One PBKDF2 run produces both the verifier and the AES key.
 */

import { unlockDocument } from "../api/documentsApi";
import type { Document } from "../types";
import {
  base64ToBytes,
  decryptWithKey,
  deriveSecrets,
  InvalidPasswordError,
} from "./lockCrypto";

/** The server accepted the password but the downloaded bytes failed GCM authentication. */
export class FileIntegrityError extends Error {
  constructor() {
    super(
      "The file could not be decrypted. It may be corrupted or was modified.",
    );
    this.name = "FileIntegrityError";
  }
}

export async function unlockAndDecrypt(
  idToken: string,
  doc: Document,
  password: string,
): Promise<{ blob: Blob; filename: string }> {
  if (!doc.lock_kdf) {
    throw new Error("This file is missing its lock parameters.");
  }

  const { aesKey, verifier } = await deriveSecrets(
    password,
    base64ToBytes(doc.lock_kdf.salt),
    doc.lock_kdf.iterations,
  );

  // Rejects with "<status>: <message>" if the verifier is wrong or the file is locked out.
  const released = await unlockDocument(idToken, doc.file_id, verifier);

  const response = await fetch(released.url);
  if (!response.ok) {
    throw new Error("Could not download the encrypted file.");
  }
  const ciphertext = new Uint8Array(await response.arrayBuffer());

  try {
    const plaintext = await decryptWithKey(ciphertext, aesKey, released.iv);
    return {
      blob: new Blob([plaintext], { type: released.content_type }),
      filename: released.filename,
    };
  } catch (err) {
    if (err instanceof InvalidPasswordError) throw new FileIntegrityError();
    throw err;
  }
}
