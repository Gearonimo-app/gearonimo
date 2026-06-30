import { describe, it, expect } from "vitest";
import { deriveKey, encryptJson, decryptJson, makePinCheck, verifyPinCheck, randomBytes } from "./crypto";

describe("offline crypto", () => {
  it("round-trips data with the correct PIN", async () => {
    const salt = randomBytes(16);
    const key = await deriveKey("1234", salt);
    const payload = await encryptJson(key, { name: "Jan Janssen", note: "geheim" });
    const result = await decryptJson<{ name: string; note: string }>(key, payload);
    expect(result).toEqual({ name: "Jan Janssen", note: "geheim" });
  });

  it("fails to decrypt with a different PIN (same salt)", async () => {
    const salt = randomBytes(16);
    const correctKey = await deriveKey("1234", salt);
    const wrongKey = await deriveKey("9999", salt);
    const payload = await encryptJson(correctKey, { secret: true });
    await expect(decryptJson(wrongKey, payload)).rejects.toThrow();
  });

  it("accepts the correct PIN via the check value", async () => {
    const salt = randomBytes(16);
    const key = await deriveKey("4242", salt);
    const check = await makePinCheck(key);
    const sameKey = await deriveKey("4242", salt);
    expect(await verifyPinCheck(sameKey, check)).toBe(true);
  });

  it("rejects a wrong PIN via the check value instead of throwing", async () => {
    const salt = randomBytes(16);
    const key = await deriveKey("4242", salt);
    const check = await makePinCheck(key);
    const wrongKey = await deriveKey("0000", salt);
    expect(await verifyPinCheck(wrongKey, check)).toBe(false);
  });

  it("uses a fresh random IV per encryption (ciphertexts differ for identical data)", async () => {
    const salt = randomBytes(16);
    const key = await deriveKey("1234", salt);
    const a = await encryptJson(key, { x: 1 });
    const b = await encryptJson(key, { x: 1 });
    expect(new Uint8Array(a.ciphertext)).not.toEqual(new Uint8Array(b.ciphertext));
  });
});
