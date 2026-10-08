# MVP 可行性检查

检查时间：2026-10-08，Asia/Shanghai。

**普通小游戏范围内，五项主检查均已实测通过（5/5）。Codex 原生 MCP 接口已完成真实日志调用；Unity 导出包仍需另外验证。**

| 检查项 | 结论 | 证据 |
| --- | --- | --- |
| 官方 CLI 能打开 Unity / 小游戏 | 普通小游戏通过；Unity 待验 | 官方 tmg 2.1.1 打开 hello-game，IDE 4.5.6 模拟器成功连接；未测试 Unity 导出包 |
| IDE 进程有无调试端口 | 通过 | 从 IDE 日志定位本机 CDP HTTP 端口，发现并连接归属目标项目的模拟器 WebSocket |
| 能否读取小游戏 Console | 通过 | 从真实 IDE 捕获 console.error 与基础库输出的异常描述、堆栈，经 MCP 返回 |
| 重新编译后是否持续采集 | 通过 | A、B 两次源文件保存均触发 IDE 重编译；同一 MCP 会话使用已有游标，分别收到新版 error 和至少两条新版 tick |
| Codex 能通过 MCP 获得日志 | 通过 | 已注册全局 douyin 服务；Codex 0.152.1 app-server 原生 mcpServer/tool/call 成功调用 open/get_logs/get_errors/watch，读取真实错误和新增 tick |

## 重编译实测

18:24:45 保存 A 版，收到对应 error，随后在 18:24:47、18:24:48 收到新版 tick。18:24:49 保存 B 版，同样收到对应 error，随后在 18:24:51、18:24:52 收到新版 tick。

两轮使用同一个 MCP 客户端、同一服务器进程和连续游标，没有重新 open 或重启 MCP。模拟器在本次重编译中保持原调试连接，因此另外执行了断线测试。

测试仅临时修改仓库演示小游戏，结束后恢复原始 game.js，SHA-256 与测试前备份相同。

## 真实断线补测

18:26 通过本地透明 WebSocket 转发器转发真实 IDE 的 CDP 文本帧，再只断开本次测试自己的连接。没有关闭其他项目或终止 IDE。

- 连接次数从 1 增加到 2，说明自动重连发生。
- `possibleGapCount` 为 1，保留了断线提示。
- 指定示例错误从重连前 2 条到重连后 2 条，没有回放重复。
- 18:26:48 再次收到新的 `tick 23`，证明恢复后的实时采集可用。

这证明真实运行时连接中断后的恢复，不等同于已经验证 IDE 进程重启、端口变化或所有 Unity 运行时布局。

## Codex 原生接入验收

18:31，使用全局已安装的官方 CLI 2.1.1，将 `douyin` 以 stdio 注册到本机 Codex 配置。启动超时为 15 秒，工具超时为 150 秒；原有其他 MCP 服务的启用状态保持不变。

验收运行本机 `codex-cli 0.152.1` 的 app-server，读取实际用户配置，在不持久化的测试会话中使用 Codex 自身的 `mcpServerStatus/list` 和 `mcpServer/tool/call`。本次没有使用通用 MCP SDK 客户端替代 Codex，也没有发起模型推理或预览上传。

| 调用 | 实际结果 |
| --- | --- |
| 工具发现 | Codex 识别全部 5 个 douyin 工具 |
| `douyin_open_project` | hello-game 打开成功，模拟器 connected |
| `douyin_get_logs` | 返回真实 tick 80–84，各含 4 帧堆栈 |
| `douyin_get_errors` | 返回故意打印的示例 error（16 帧）与基础库捕获的示例异常（8 帧） |
| `douyin_watch_logs` | 在 18:31:58 返回新产生的 tick 85，连接正常 |

因此通过的是 **Codex 原生 MCP 连接与调用链路**。当前已打开的桌面聊天可能仍使用旧工具列表；需让客户端重新加载配置后，才可在该聊天里直接使用新工具。本次不把原生 API 验收夸大为自然语言自动选工具的行为测试。

协议依据：[Codex App Server 官方文档](https://learn.chatgpt.com/docs/app-server)；配置依据：[Codex MCP 官方文档](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)。

## 仍需补齐

若第一项要求同时覆盖 Unity，则需用一个真实 Unity 抖音导出包验证打开和日志目标匹配。

预览上传不属于这张五项可行性清单。它目前仅完成官方 CLI 接入与模拟测试，真实账号上传仍待验证。
