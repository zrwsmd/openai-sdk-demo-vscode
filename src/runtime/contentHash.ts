import { createHash } from "node:crypto";

/** Stable content fingerprint shared by file-oriented tools and plugins. */
export function hashContent(content: string): string {
  return createHash("sha1").update(content).digest("hex");
}
