import { createHash } from "node:crypto";

export function hashStContent(content: string): string {
  return createHash("sha1").update(content).digest("hex");
}
