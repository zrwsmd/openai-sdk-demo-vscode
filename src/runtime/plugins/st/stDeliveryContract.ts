import {
  normalizeWorkflowContract,
  type DeliveryContract,
} from "../../deliveryContract";

export function createStCodeDeliveryContract(options: {
  reason?: string;
  workspacePersistence?: "required" | "not_required" | "optional";
  runtimeEntry?: "required" | "not_required" | "optional";
} = {}): DeliveryContract {
  const workspacePersistence = options.workspacePersistence ?? "required";
  const runtimeEntry =
    options.runtimeEntry ??
    (workspacePersistence === "required" ? "required" : "not_required");
  return normalizeWorkflowContract({
    requiresDeliverable: true,
    reason: options.reason ?? (
      workspacePersistence === "required"
        ? "用户要求生成 ST 代码，运行时按固定流水线校验并保存到当前工作区"
        : "用户要求生成 ST 代码但不强制保存文件"
    ),
    deliverables: [{
      kind: "code",
      title: "ST 程序",
      description: "完整 IEC 61131-3 ST 控制程序源码",
      required: true,
      acceptableEvidence: workspacePersistence === "required"
        ? ["delivery_commit"]
        : ["final_artifact"],
      workspacePersistence,
      workspaceFileExtension: ".st",
      requiredVerificationTools: ["validate_st_code"],
      runtimeEntry,
    }],
  })!;
}

export function inferStDeliveryContractFromUserText(
  userText: string,
): DeliveryContract | undefined {
  const text = userText.trim();
  if (!isStCodeGenerationRequest(text)) return undefined;
  const workspacePersistence = wantsInlineOnly(text) ? "not_required" : "required";
  return createStCodeDeliveryContract({
    reason: workspacePersistence === "required"
      ? "用户要求生成 ST 代码，运行时按固定流水线校验并保存到当前工作区"
      : "用户要求生成 ST 代码但不强制保存文件",
    workspacePersistence,
    runtimeEntry: wantsReusableLibraryOnly(text) ? "not_required" : undefined,
  });
}

export function isStCodeDeliveryContract(contract?: DeliveryContract): boolean {
  return contract?.requiresDeliverable === true &&
    contract.deliverables.some((deliverable) =>
      deliverable.required &&
      deliverable.workspaceFileExtension?.toLowerCase() === ".st" &&
      deliverable.requiredVerificationTools?.includes("validate_st_code"),
    );
}

export function isStWorkspaceDeliveryContract(contract?: DeliveryContract): boolean {
  return isStCodeDeliveryContract(contract) &&
    contract?.deliverables.some((deliverable) =>
      deliverable.required &&
      deliverable.workspacePersistence === "required" &&
      deliverable.workspaceFileExtension?.toLowerCase() === ".st",
    ) === true;
}

export function requiresStRuntimeProgram(contract?: DeliveryContract): boolean {
  return isStCodeDeliveryContract(contract) &&
    contract?.deliverables.some((deliverable) =>
      deliverable.required &&
      deliverable.workspaceFileExtension?.toLowerCase() === ".st" &&
      deliverable.workspacePersistence === "required" &&
      deliverable.runtimeEntry !== "not_required",
    ) === true;
}

function isStCodeGenerationRequest(text: string): boolean {
  if (!text) return false;
  const asksToProduce =
    /(?:生成|设计|编写|写(?:一段|一个|一份)?|实现|创建|输出|给出|保存|落地|generate|create|write|implement|design)/iu.test(text);
  if (!asksToProduce) return false;
  const mentionsCode = /(?:代码|源码|程序|控制程序|控制逻辑|program|code|source)/iu.test(text);
  if (!mentionsCode) return false;
  const mentionsSt =
    /(?:\bST\b|ST\s*语言|结构化文本|Structured\s*Text|IEC\s*61131)/iu.test(text);
  const mentionsPlcProgram =
    /(?:PLC|可编程控制器|水泵|电机|阀门|液位|泵站)[\s\S]{0,120}(?:程序|代码|控制逻辑|控制程序)/iu.test(text) ||
    /(?:程序|代码|控制逻辑|控制程序)[\s\S]{0,120}(?:PLC|可编程控制器)/iu.test(text);
  return mentionsSt || mentionsPlcProgram;
}

function wantsInlineOnly(text: string): boolean {
  return /(?:不要|不用|无需|不需要|别|勿)[^。！？\r\n]{0,16}(?:保存|写入|写文件|落盘)|(?:只|仅)[^。！？\r\n]{0,10}(?:展示|显示|贴出|输出|看代码)/u.test(text);
}

function wantsReusableLibraryOnly(text: string): boolean {
  const explicitlyReusable =
    /(?:只|仅|单独|专门)[^。！？\r\n]{0,24}(?:功能块|函数块|函数|类型|结构体|别名|库|library|function[_\s-]*block|function|type)/iu.test(text) ||
    /(?:生成|编写|创建|实现)[^。！？\r\n]{0,24}(?:功能块|函数块|函数|类型|结构体|别名|库|library|function[_\s-]*block|function|type)[^。！？\r\n]{0,24}(?:供复用|复用|不需要运行|无需运行|不绑定任务|不需要任务)/iu.test(text);
  return explicitlyReusable && !/(?:主入口|入口程序|可运行|运行起来|绑定任务|任务周期|周期任务|部署到 PLC)/iu.test(text);
}
