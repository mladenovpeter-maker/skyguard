import { randomBytes, createHash } from "node:crypto";

const KEY_PREFIX = "sg_";

/** Generates a new plaintext API key for a device. Shown to the user exactly once. */
export function generateDeviceKey(): string {
  return `${KEY_PREFIX}${randomBytes(24).toString("hex")}`;
}

/** One-way hash of a device API key for storage/lookup (keys are high-entropy, so SHA-256 is sufficient). */
export function hashDeviceKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

/** Short, non-secret prefix shown in the UI so a device can be identified without exposing the key. */
export function keyDisplayPrefix(key: string): string {
  return key.slice(0, KEY_PREFIX.length + 6);
}
