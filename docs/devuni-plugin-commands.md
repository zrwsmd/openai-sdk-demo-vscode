# devUni IDE 插件命令全量清单

来源：ytak.devuni-ide-vscode-1.0.21 的 package.json → contributes.commands。

共 160 条。标记 ✔ 的是 vscode-command-bridge 已经挂出来、我们这边能调到的，目前只有 3 条。

## (other)（5 条）

| 命令 id | 标题 | 桥 |
|---|---|---|
| `demo.startRun` | startRun |  |
| `demo.setNum` | set var |  |
| `demo.parper` | set var |  |
| `devUni.togglePanel` | 关闭面板 |  |
| `devuni.statusBar.showMenu` | 显示 DevUni 菜单 |  |

## IUView（9 条）

| 命令 id | 标题 | 桥 |
|---|---|---|
| `devUni.IUView.addLocalDomain` | Add local domain |  |
| `devUni.IUView.addCloudDomain` | Add cloud domain |  |
| `devUni.IUView.refreshTreeView` | refresh treeview |  |
| `devUni.IUView.rename` | rename IU |  |
| `devUni.IUView.detectIU` | detect IU |  |
| `devUni.IUView.generateVIUs` | generate vIUs |  |
| `devUni.IUView.subscribeFromIU` | subscribe from IU |  |
| `devUni.IUView.getVIUs` | get vIUs |  |
| `devUni.IUView.updateDataInVIUs` | update data in vIUs |  |

## prjView（146 条）

| 命令 id | 标题 | 桥 |
|---|---|---|
| `devUni.prjView.uploadLocalFile` | 上传本地文件 |  |
| `devUni.prjView.uploadLocalFileDir` | 上传本地文件夹 |  |
| `devUni.prjView.transTxtToLD` | transTxtToLD |  |
| `devUni.prjView.transTxtToHMI` | transTxtToHMI |  |
| `devUni.prjView.checkConnectStatus` | checkConnectStatus |  |
| `devUni.prjView.splitScreen` | Horizontal splitScreen |  |
| `devUni.prjView.writeVarOnce` | 写入准备值 |  |
| `devUni.prjView.writeVarForce` | 强制写入准备值 |  |
| `devUni.prjView.clearForceVar` | 释放强制写入准备值 |  |
| `devUni.prjView.verticalSplitScreen` | 变量监控列表 |  |
| `devUni.prjView.createPrj` | 创建工程 | ✔ |
| `devUni.prjView.refreshPrjTree` | refresh project tree view |  |
| `devUni.prjView.openPrj` | 打开工程 |  |
| `devUni.prjView.closePrj` | 关闭工程 |  |
| `devUni.prjView.renamePrj` | 重命名PLC工程 |  |
| `devUni.prjView.deletePrjComp` | 删除 |  |
| `devUni.prjView.renamePrjComp` | 重命名 |  |
| `devUni.prjView.renamePou` | 重命名POU |  |
| `devUni.prjView.deletePou` | 删除POU |  |
| `devUni.prjView.createBus` | 添加总线 |  |
| `devUni.prjView.createApp` | 添加Plc应用 |  |
| `devUni.prjView.creatAppCom` | 添加应用组件 |  |
| `devUni.prjView.createPou` | 添加POU |  |
| `devUni.prjView.createDut` | 添加数据类型 |  |
| `devUni.prjView.createPlcDir` | 添加文件夹 |  |
| `devUni.prjView.createGvl` | 添加全局变量列表 |  |
| `devUni.prjView.createTask` | 创建任务 |  |
| `devUni.prjView.createPouInTask` | 创建程序调用 |  |
| `devUni.prjView.addTraceV2` | 创建跟踪调试 |  |
| `devUni.prjView.delTraceV2` | 删除跟踪调试 |  |
| `devUni.prjView.addVarMonitor` | 添加变量监控 |  |
| `devUni.prjView.delVarMonitor` | 删除变量监控 |  |
| `devUni.prjView.createTrace` | 创建跟踪调试1 |  |
| `devUni.prjView.addExtProtocol` | 添加外部总线 |  |
| `devUni.prjView.addSubDev` | 添加子设备 |  |
| `devUni.prjView.delExtProtocol` | 删除总线 |  |
| `devUni.prjView.insertSubDev` | 插入设备 |  |
| `devUni.prjView.delSubDev` | 删除设备 |  |
| `devUni.prjView.exchangeDev` | 交换设备 |  |
| `devUni.prjView.replaceDev` | 替换设备 |  |
| `devUni.prjView.moveDev` | 移动设备 |  |
| `devUni.prjView.createHmi` | 创建HMI |  |
| `devUni.prjView.launchTrace` | 开始跟踪调试 |  |
| `devUni.prjView.stopTrace` | 停止跟踪调试 |  |
| `devUni.prjView.rollingDataForTrace` | 自动滚动 |  |
| `devUni.prjView.importLibFromCloud` | 从服务器导入库 |  |
| `devUni.prjView.importLibFromLocal` | 从本地导入库 |  |
| `devUni.prjView.importEsi` | 导入 ESI |  |
| `devUni.prjView.createEthcateS` | 添加从站 |  |
| `devUni.prjView.cfgEthcateS` | 配置从站 |  |
| `devUni.prjView.cfgEthcateM` | 配置主站 |  |
| `devUni.prjView.insertEthcateS` | 插入从站 |  |
| `devUni.prjView.putModule` | 插入模块 |  |
| `devUni.prjView.delModule` | 移除模块 |  |
| `devUni.prjView.addplcLogic` | add plcLogic to project |  |
| `devUni.prjView.addeqDiag` | add eqDiag to project |  |
| `devUni.prjView.addnetCfg` | add netCfg to project |  |
| `devUni.prjView.addcpuRack` | add cpuRack to project |  |
| `devUni.prjView.addcanopenRack` | add canopenRack to project |  |
| `devUni.prjView.addetherCatRack` | add etherCatRack to project |  |
| `devUni.prjView.addresUseTab` | add resUseTab to project |  |
| `devUni.prjView.addsoftMotionGap` | add softMotionGap to project |  |
| `devUni.prjView.addhighSpeedIo` | add highSpeedIo to project |  |
| `devUni.prjView.addmodbusTcp` | add modbusTcp to project |  |
| `devUni.prjView.addapp` | add application to project |  |
| `devUni.prjView.addlibs` | add library manager to project |  |
| `devUni.prjView.addtsm` | add task manager to project |  |
| `devUni.prjView.addlib` | add lib to project |  |
| `devUni.prjView.revealLib` | reveal lib |  |
| `devUni.prjView.revealLibItem` | reveal lib item |  |
| `devUni.prjView.addtsk` | add task to project |  |
| `devUni.prjView.addtrace` | add trace to project |  |
| `devUni.prjView.addhmi` | add trace to project |  |
| `devUni.prjView.addethCatM` | add ethercat master to project |  |
| `devUni.prjView.addethCatS` | add ethercat slave to project |  |
| `devUni.prjView.addst` | add a DUT to project |  |
| `devUni.prjView.adddut` | add a DUT to project |  |
| `devUni.prjView.addgvl` | add a GVL to project |  |
| `devUni.prjView.selEthcatS` | 添加 |  |
| `devUni.prjView.selEthcatMod` | 添加 |  |
| `devUni.prjView.getParent` | getParent |  |
| `devUni.prjView.getViewItem` | getViewItem |  |
| `devUni.prjView.addPouToTask` | 添加POU到任务 |  |
| `devUni.prjView.delPouFromTask` | delete pou from task |  |
| `devUni.prjView.cfgTask` | config task |  |
| `devUni.prjView.revealTskManPanel` | reveal task manager panel |  |
| `devUni.prjView.revealTracePanel` | reveal trace panel |  |
| `devUni.prjView.revealHmiPanel` | reveal Hmi panel |  |
| `devUni.prjView.runHmiPanel` | run Hmi panel |  |
| `devUni.prjView.runPrj` | runPrj |  |
| `devUni.prjView.revealCpuRackPanel` | reveal cpuRack panel |  |
| `devUni.prjView.hmiPanelSelect` | 选中运行 |  |
| `devUni.prjView.hmiPanelHasSelect` | 取消选中 |  |
| `devUni.prjView.setFsTask` | set fs task |  |
| `devUni.prjView.getTaskListOfPrj` | get task list of project |  |
| `devUni.prjView.onDidTaskUpdate` | register event for task updating |  |
| `devUni.prjView.didTaskUpdate` | update in task manager |  |
| `devUni.prjView.openPou` | open pou |  |
| `devUni.prjView.revealPouVarPanle` | reveal pou variable panel |  |
| `devUni.prjView.disMoniPou` | dispose monitor pou |  |
| `devUni.prjView.subCollapse` | subCollapse |  |
| `devUni.prjView.searchLib` | search in lib |  |
| `devUni.prjView.edidHmiUserGroup` | 编辑用户分组 |  |
| `devUni.prjView.connectRuntime` | 连接设备 |  |
| `devUni.prjView.disconnectRuntime` | 断开设备连接 |  |
| `devUni.prjView.readyLoginRuntime` | 预登录设备 |  |
| `devUni.prjView.installRuntime` | 登录设备 |  |
| `devUni.prjView.deinstallRuntime` | 退出登录设备 |  |
| `devUni.prjView.runApp` | 运行应用 |  |
| `devUni.prjView.readyStartDebug` | 运行应用 |  |
| `devUni.prjView.workbenchStopApp` | 停止运行应用 |  |
| `devUni.prjView.getAppOfComp` | get app of comp |  |
| `devUni.prjView.getVarListFromDeploy` | get var list from deploy |  |
| `devUni.prjView.onDidVarListFromDeploy` | on did var list from deploy |  |
| `devUni.prjView.onDidInstallReadyFromDeploy` | on did install ready from deploy |  |
| `devUni.prjView.getAppComp` | get app where comp reside |  |
| `devUni.prjView.isDeployRun` | Is ths deploy status run |  |
| `devUni.prjView.createTraceDeploy` | launch trace in deploy |  |
| `devUni.prjView.launchTraceDeploy` | launch trace in deploy |  |
| `devUni.prjView.stopTraceDeploy` | stop trace in deploy |  |
| `devUni.prjView.clearTraceDeploy` | stop trace in deploy |  |
| `devUni.prjView.onDidPrjComplete` | on did prj load complete |  |
| `devUni.prjView.refreshViewCompOfPrjComp` | reflesh view comp of prj comp |  |
| `devUni.prjView.subPouVar` | subscrible pou variable |  |
| `devUni.prjView.unsubPouVar` | unsubscrible pou variable |  |
| `devUni.prjView.testForTrace` | test for trace |  |
| `devUni.prjView.createSshClientAndConnect` | test for create ssh client and connect ssh server |  |
| `devUni.prjView.uploadFile` | test for upload file to server |  |
| `devUni.prjView.forwardOut` | test for forward out |  |
| `devUni.prjView.testSsh` | test ssh |  |
| `devUni.prjView.testSshInput` | test ssh input |  |
| `devUni.prjView.execSshCmd` | test for exec cmd by ssh |  |
| `devUni.prjView.getDataFromFile` | test for get data from file |  |
| `devUni.prjView.createOpcUaClientAndConnect` | test for create opcUA client and connect |  |
| `devUni.prjView.disconnectFromOpcUaServer` | test for disconnect from opcUAServer |  |
| `devUni.prjView.getDataFromOpcUaServer` | test for get data from opnUa server |  |
| `devUni.prjView.connectTcpServer` | test for connect tcp server |  |
| `devUni.prjView.testParseNtf` | test for parse ntf |  |
| `devUni.prjView.testTar` | test tar |  |
| `devUni.prjView.testOutput` | test output |  |
| `devUni.prjView.pushOptQueue` | push option into prjQueue |  |
| `devUni.prjView.compilePlcApp` | 编译plc应用 |  |
| `devUni.prjView.saveTraceRecordFile` | 保存记录文件 |  |
| `devUni.prjView.loadTraceRecordFile` | 载入记录文件 |  |
| `devUni.prjView.addAxisCfg` | 添加轴配置 |  |
| `devUni.prjView.delAxisCfg` | 删除轴配置 |  |

