import { describe, it, expect } from "vitest";
import {
  KDF_ITERATIONS,
  GCM_TAG_BYTES,
  InvalidPasswordError,
  base64ToBytes,
  bytesToBase64,
  computeVerifier,
  decryptBytes,
  decryptWithKey,
  deriveSecrets,
  encryptBytes,
} from "./lockCrypto";

// PBKDF2 at 600k iterations takes a few hundred ms; tests use a low count
// except the one test that checks the production default.
const FAST = 1_000;

function sampleBytes(length: number): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(length);
  for (let i = 0; i < length; i++) bytes[i] = (i * 31 + 7) % 256;
  return bytes;
}

describe("lockCrypto", () => {
  it("round-trips: decrypt(encrypt(x)) returns x", async () => {
    const plain = sampleBytes(10_000);
    const enc = await encryptBytes(plain, "correct horse", FAST);
    const dec = await decryptBytes(enc.ciphertext, "correct horse", enc.params);
    expect(Array.from(dec)).toEqual(Array.from(plain));
  });

  it("ciphertext is exactly plaintext + 16 bytes", async () => {
    const plain = sampleBytes(1234);
    const enc = await encryptBytes(plain, "pw", FAST);
    expect(enc.ciphertext.length).toBe(plain.length + GCM_TAG_BYTES);
  });

  it("handles an empty file", async () => {
    const enc = await encryptBytes(new Uint8Array(0), "pw", FAST);
    expect(enc.ciphertext.length).toBe(GCM_TAG_BYTES);
    const dec = await decryptBytes(enc.ciphertext, "pw", enc.params);
    expect(dec.length).toBe(0);
  });

  it("rejects a wrong password with InvalidPasswordError", async () => {
    const enc = await encryptBytes(sampleBytes(100), "right", FAST);
    await expect(
      decryptBytes(enc.ciphertext, "wrong", enc.params),
    ).rejects.toBeInstanceOf(InvalidPasswordError);
  });

  it("rejects a tampered ciphertext (integrity)", async () => {
    const enc = await encryptBytes(sampleBytes(100), "pw", FAST);
    const tampered = new Uint8Array(enc.ciphertext);
    tampered[5] ^= 0xff;
    await expect(
      decryptBytes(tampered, "pw", enc.params),
    ).rejects.toBeInstanceOf(InvalidPasswordError);
  });

  it("uses a fresh random salt and IV every time", async () => {
    const plain = sampleBytes(50);
    const a = await encryptBytes(plain, "pw", FAST);
    const b = await encryptBytes(plain, "pw", FAST);
    expect(a.params.salt).not.toBe(b.params.salt);
    expect(a.params.iv).not.toBe(b.params.iv);
    expect(Array.from(a.ciphertext)).not.toEqual(Array.from(b.ciphertext));
  });

  it("verifier is deterministic for the same password + salt", async () => {
    const enc = await encryptBytes(sampleBytes(10), "pw", FAST);
    expect(await computeVerifier("pw", enc.params)).toBe(enc.verifier);
    expect(await computeVerifier("pw", enc.params)).toBe(enc.verifier);
  });

  it("verifier differs for a different password", async () => {
    const enc = await encryptBytes(sampleBytes(10), "pw", FAST);
    expect(await computeVerifier("other", enc.params)).not.toBe(enc.verifier);
  });

  it("verifier is 32 bytes (44 base64 chars), under bcrypt's 72-byte limit", async () => {
    const enc = await encryptBytes(sampleBytes(10), "pw", FAST);
    expect(enc.verifier.length).toBe(44);
    expect(base64ToBytes(enc.verifier).length).toBe(32);
  });

  it("works with unicode passwords", async () => {
    const plain = sampleBytes(64);
    const enc = await encryptBytes(plain, "kata laluan 密码 🔒", FAST);
    const dec = await decryptBytes(enc.ciphertext, "kata laluan 密码 🔒", enc.params);
    expect(Array.from(dec)).toEqual(Array.from(plain));
  });

  it("uses the production iteration count by default", async () => {
    const enc = await encryptBytes(sampleBytes(10), "pw");
    expect(enc.params.iterations).toBe(KDF_ITERATIONS);
    expect(KDF_ITERATIONS).toBeGreaterThanOrEqual(600_000);
  }, 20_000);

  it("base64 helpers round-trip arbitrary bytes", () => {
    const bytes = sampleBytes(300);
    expect(Array.from(base64ToBytes(bytesToBase64(bytes)))).toEqual(
      Array.from(bytes),
    );
  });

  it("deriveSecrets gives the same verifier and a key that decrypts (unlock flow)", async () => {
    const plain = sampleBytes(500);
    const enc = await encryptBytes(plain, "pw", FAST);
    const { aesKey, verifier } = await deriveSecrets(
      "pw",
      base64ToBytes(enc.params.salt),
      enc.params.iterations,
    );
    expect(verifier).toBe(enc.verifier);
    const dec = await decryptWithKey(enc.ciphertext, aesKey, enc.params.iv);
    expect(Array.from(dec)).toEqual(Array.from(plain));
  });

  it("decryptWithKey with the wrong password's key throws InvalidPasswordError", async () => {
    const enc = await encryptBytes(sampleBytes(20), "right", FAST);
    const { aesKey } = await deriveSecrets(
      "wrong",
      base64ToBytes(enc.params.salt),
      enc.params.iterations,
    );
    await expect(
      decryptWithKey(enc.ciphertext, aesKey, enc.params.iv),
    ).rejects.toBeInstanceOf(InvalidPasswordError);
  });
});
