import { promises as fs } from "node:fs";
import path from "node:path";
import {
  WorkspaceScope,
  type ResolvedWorkspacePath,
} from "../workspace/workspaceScope";
import { AgentActionVerificationError } from "./agentErrors";
import type { Artifact } from "../protocol/results";

export async function verifyWorkspaceWrite(
  workspaceRoot: string | WorkspaceScope,
  relativePath: string,
  expectedContent: string,
): Promise<Artifact> {
  const scope =
    workspaceRoot instanceof WorkspaceScope
      ? workspaceRoot
      : new WorkspaceScope(workspaceRoot ? [workspaceRoot] : []);
  const resolved: ResolvedWorkspacePath = scope.resolve(relativePath);
  const actual = await fs.readFile(resolved.absolutePath, "utf8").catch(() => undefined);
  if (actual !== expectedContent) {
    throw new AgentActionVerificationError(
      `工具 write_file 返回成功，但文件校验失败: ${relativePath}`,
    );
  }
  return {
    kind: "file",
    name: path.basename(resolved.absolutePath),
    uri: resolved.absolutePath,
    mimeType: "text/plain",
    metadata: { bytes: Buffer.byteLength(actual) },
  };
}
