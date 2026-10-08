# 兼容性与排障

最后验证：2026-10-08。

## 验证矩阵

| 环境 / 功能 | 状态 | 证据与限制 |
| --- | --- | --- |
| Windows 10 / Node 24.13 / IDE 4.5.6 / tmg 2.1.1 | 本机实测 | MCP stdio 打开演示游戏、读取错误堆栈、获取新增 tick |
| Console log / warn / error | 本机实测 | `examples/hello-game` |
| 被基础库捕获的异常 | 本机实测 | 示例异常由基础库打印为 console.error，保留异常描述与堆栈 |
| 原生 `Runtime.exceptionThrown` | 协议集成测试 | 模拟 CDP 事件，未把基础库捕获的异常冒充此事件 |
| 保存代码后重新编译并持续采集 | 本机实测 | 同一 MCP 会话连续保存 A/B 两版代码，分别捕获新版 error 和至少两条后续 tick，源码已恢复 |
| 真实运行时断线重连与近期错误去重 | 本机实测 | 本地透明 WebSocket 转发器只断开本次测试连接；自动重连，错误条数 2→2，并读到新 tick；不是 IDE 进程重启测试 |
| 过滤、游标与溢出 | 自动化测试 | 本地 HTTP/WebSocket 测试夹具 |
| Codex 原生 MCP 接口调用 | 本机实测 | 已注册全局 douyin；Codex 0.152.1 app-server 原生工具调用获得真实日志、两条示例错误和新增 tick；非模型选工具行为测试 |
| 预览参数、PNG 返回、缺少图片时的失败 | 自动化测试 | 假 CLI；未进行真实账号上传 |
| macOS 上的真实 IDE | 待验证 | 包含常见日志路径发现逻辑，不能据此声称已兼容 |
| Unity/Wasm 导出包 | 待验证 | 官方 CLI 可打开导出目录；日志适配器仅识别 microgame 模拟器 webview |
| Linux | 仅协议测试目标 | 不宣称有可用的抖音 IDE 桌面版 |
| 真机、独立 Worker、其他 IDE 版本 | 尚未支持/待适配 | 不会自动附着到无法证明项目归属的目标 |

Windows/macOS/Linux 的 GitHub Actions 已配置；远端运行结果需推送后确认，不等同于本地已验证三个平台。

按五项 MVP 清单的逐项验收结论见 [MVP 可行性检查](mvp-feasibility.md)。

## 为什么不用 IDE 的 main.log 当游戏日志

`logs/main.log` 记录 IDE 本身行为。适配器只从末尾最多 256 KiB 中提取 `[IDE INSPECT PORT]`，随后访问本机 `/json/list`，按导出项目路径定位工作台，按父子关系定位 `/miniapp/index.html?type=microgame`。

真正的 Console 来自模拟器 WebSocket 上的 `Runtime.consoleAPICalled`、`Runtime.exceptionThrown`。只发送 `Runtime.enable`，不修改安装目录、不注入游戏代码、不执行任意脚本、不读取 IDE 账号文件。

该目标布局是 4.5.6 的实现细节，官方 CLI 文档并未承诺提供稳定的外部日志接口。升级后若布局变化，适配器可能明确失败。欢迎携带脱敏的目标结构提交适配问题。

## 常见问题

### CLI 找不到

```sh
npm install -g tt-minigame-ide-cli
npm root -g
```

将全局目录下的 `tt-minigame-ide-cli/bin/tmg.js` 设置为 `DOUYIN_CLI_PATH`。Windows 的 `.cmd` 包装器不作为可执行入口，避免 shell 转义与命令拼接；程序用 Node 直接执行 JS 文件。

### 无法发现调试端口

先启动 IDE，再运行 `node dist/index.js --doctor`。常见日志位置：

- Windows：`%APPDATA%/@byted/vela/logs/main.log`
- macOS：`~/Library/Application Support/@byted/vela/logs/main.log`（待实机验证）

兼容旧目录 `@byted/miniprogram-ide`。自定义用户目录可设置 `DOUYIN_IDE_LOG_PATH`。如果日志里的端口已过期，重启 IDE 后重试，或者将 `DOUYIN_CDP_ENDPOINT` 显式设为当前本机 HTTP 调试地址。**端口可能变化，不要照抄别人机器的端口。**

只允许 `localhost`、`127.0.0.1`、`::1`，不支持远程调试服务器或 HTTP 重定向。不要将 IDE 调试端口暴露到公网。

### 打开成功但日志未连接

`tmg open` 成功只是发出打开请求。等待模拟器加载并查看 `connection.lastError`，或再调用 get_logs。默认每 2 秒重试。优先使用 full 模式，关闭同一项目的重复窗口。

确认传入的是抖音小游戏**导出目录**，而不是 Unity 的 `Assets` 源工程或微信小游戏导出包。若 Unity 模式没有普通 microgame webview，会明确返回不支持的运行时布局，不会误读编辑器日志。

### 断线后为什么仍返回旧日志

缓存保留了断线前证据，所以允许读取，同时返回 `disconnected` 和累计缺口计数。首次连接从未成功则报错。CDP 历史回放由 IDE 决定，重连无法保证恢复全部缺失日志。缓冲窗口之外的历史回放也可能重复。

### 日志行号不等于源文件行号

IDE 会编译和包装脚本；当前返回的是 CDP 提供的 1 起始运行时位置。v0.1.0 没有 source map 还原。不要盲目按同一行号修改原始源码，应结合文件、函数和错误信息定位。

### 预览失败

1. 在终端运行 `tmg login` 完成登录；不要把密码发给 MCP。
2. 确认 AppID、账号权限、抖音账号绑定及网络可用。
3. 先在终端运行 `tmg preview <项目绝对路径> --output <图片绝对路径>`，核对官方 CLI 行为。
4. MCP 客户端超时至少设为 150 秒。

预览需要平台上传；`examples/hello-game` 的测试 AppID 不代表真实账号权限已验证。

## 参考来源

- [抖音小游戏官方 CLI](https://partner.open-douyin.com/docs/resource/zh-CN/mini-game/develop/dev-tools/development-assistance/ide-cli)
- [抖音 IDE 下载与版本记录](https://developer.open-douyin.com/docs/resource/zh-CN/mini-game/develop/dev-tools/developer-instrument-update-and-download)
- [Chrome DevTools Protocol Runtime](https://chromedevtools.github.io/devtools-protocol/tot/Runtime/)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)

适配器代码为本项目独立实现；仓库不包含抖音开发者工具的私有实现或账号数据。
