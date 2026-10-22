/**
 * Browser-side file lock cryptography (Web Crypto API).
 *
 * Key schedule:
 *   password + random salt
 *     -> PBKDF2-SHA256 (>= 600k iterations) -> 32-byte master secret
 *     -> HKDF-SHA256, info "safefile-aes-v1"      -> AES-256-GCM key (never leaves the browser)
 *     -> HKDF-SHA256, info "safefile-verifier-v1" -> 32-byte verifier (sent to the server)
 *
 * The two HKDF outputs are independent: knowing the verifier tells an attacker
 * nothing about the AES key. The server stores bcrypt(verifier) and uses it only
 * as a gate; the real protection is that the ciphertext cannot be decrypted
 * without the password.
 *
 * Only file content is encrypted. Ciphertext = plaintext + 16-byte GCM tag.
 */

export const KDF_ITERATIONS = 600_000;
export const SALT_BYTES = 16;
export const IV_BYTES = 12;
export const GCM_TAG_BYTES = 16;

/** Parameters stored next to the document. None of these are secret. */
export interface LockParams {
  version: 1;
  kdf: "PBKDF2-SHA256";
  iterations: number;
  /** base64 */
  salt: string;
  /** base64 */
  iv: string;
}

export interface EncryptedFile {
  ciphertext: Uint8Array<ArrayBuffer>;
  /** base64 of 32 bytes; this is what the server bcrypt-hashes. */
  verifier: string;
  params: LockParams;
}

export class InvalidPasswordError extends Error {
  constructor() {
    super("Invalid password.");
    this.name = "InvalidPasswordError";
  }
}

const encoder = new TextEncoder();
const AES_INFO = encoder.encode("safefile-aes-v1");
const VERIFIER_INFO = encoder.encode("safefile-verifier-v1");

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function randomBytes(length: number): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(length));
}

/**
 * Derive the AES key and the verifier from a password.
 * The salt and iteration count are public, so the unlock screen can fetch them
 * before it has to prove knowledge of the password.
 */
export async function deriveSecrets(
  password: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number,
): Promise<{ aesKey: CryptoKey; verifier: string }> {
  const passwordKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const masterBits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    passwordKey,
    256,
  );

  const hkdfKey = await crypto.subtle.importKey(
    "raw",
    masterBits,
    "HKDF",
    false,
    ["deriveKey", "deriveBits"],
  );
  const hkdfSalt = new Uint8Array(0);

  const aesKey = await crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: hkdfSalt, info: AES_INFO },
    hkdfKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
  const verifierBits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: hkdfSalt, info: VERIFIER_INFO },
    hkdfKey,
    256,
  );

  return {
    aesKey,
    verifier: bytesToBase64(new Uint8Array(verifierBits)),
  };
}

/** Compute only the verifier, for the unlock request. */
export async function computeVerifier(
  password: string,
  params: Pick<LockParams, "salt" | "iterations">,
): Promise<string> {
  const { verifier } = await deriveSecrets(
    password,
    base64ToBytes(params.salt),
    params.iterations,
  );
  return verifier;
}

/**
 * Encrypt file bytes with a fresh random salt and IV.
 * `iterations` is only overridden by tests; production code uses the default.
 */
export async function encryptBytes(
  plaintext: Uint8Array<ArrayBuffer>,
  password: string,
  iterations: number = KDF_ITERATIONS,
): Promise<EncryptedFile> {
  const salt = randomBytes(SALT_BYTES);
  const iv = randomBytes(IV_BYTES);
  const { aesKey, verifier } = await deriveSecrets(password, salt, iterations);

  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    aesKey,
    plaintext,
  );

  return {
    ciphertext: new Uint8Array(encrypted),
    verifier,
    params: {
      version: 1,
      kdf: "PBKDF2-SHA256",
      iterations,
      salt: bytesToBase64(salt),
      iv: bytesToBase64(iv),
    },
  };
}

/**
 * Decrypt. A wrong password and a tampered/corrupted file both fail the GCM
 * authentication check, so both surface as InvalidPasswordError (GCM cannot tell them apart).
 */
export async function decryptBytes(
  ciphertext: Uint8Array<ArrayBuffer>,
  password: string,
  params: LockParams,
): Promise<Uint8Array<ArrayBuffer>> {
  if (params.version !== 1 || params.kdf !== "PBKDF2-SHA256") {
    throw new Error("Unsupported lock parameters.");
  }
  const { aesKey } = await deriveSecrets(
    password,
    base64ToBytes(params.salt),
    params.iterations,
  );
  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: base64ToBytes(params.iv) },
      aesKey,
      ciphertext,
    );
    return new Uint8Array(decrypted);
  } catch {
    throw new InvalidPasswordError();
  }
}
