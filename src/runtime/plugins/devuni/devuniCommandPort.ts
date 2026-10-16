/**
 * 外部 IDE 插件命令端口(抽象层)。
 *
 * 内核只认这一句话:给一个命令短名和一份参数,拿回对方命令的返回值。
 * 至于底下走的是 VSCode 的 executeCommand、还是一条 CLI、还是 HTTP,内核不关心。
 *
 * 具体实现在 src/app/devuniHost.ts —— 那是这套能力里唯一 import vscode 的地方:
 * 走哪个通道、打到哪个扩展,全部关在宿主装配层;内核只看到这里那一句纯数据的 invoke。
 */
export const DEVUNI_COMMAND_PORT_SERVICE = "devuni.commandPort";

export interface DevuniCommandPort {
  /**
   * 调用对方扩展暴露的命令。
   *
   * @param command 命令短名,例如 "bridgeCreateProject"。
   * @param args 原样透传给对方命令处理器的参数。
   *
   * 参数是逐个位置传的,跟对方命令签名对齐:只收一个对象的命令(如
   * bridgeCreateProject)传一个,收多个位置参数的命令(如 bridgeOpenPrj
   * 要「工作区文件路径 + 是否在新窗口打开」两个)就传两个。
   */
  invoke(command: string, ...args: unknown[]): Promise<unknown>;
}
