import { randomBytes, randomInt } from "node:crypto";

export function createNumericPin(length: 6 | 8) {
  const upperBound = 10 ** length;
  return randomInt(0, upperBound).toString().padStart(length, "0");
}

export function createOpaqueQrCredential() {
  // 32 random bytes = 256 bits before base64url encoding.
  return randomBytes(32).toString("base64url");
}

export function createOpaqueShareToken() {
  return randomBytes(32).toString("base64url");
}
