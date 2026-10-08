# Douyin DevTools MCP

**让 AI 编程助手读懂抖音小游戏的 Console。**

[English](README.en.md) · [工具说明](docs/tools.md) · [兼容性与排障](docs/compatibility.md) · [贡献指南](CONTRIBUTING.md)

连接本机抖音开发者工具，打开小游戏、读取错误堆栈、跟踪修复后的新增日志，再通过官方 CLI 生成预览码。源码修改交给你的编程助手，MCP 提供 IDE 操作与运行时证据。

> **v0.1.0：Windows + 抖音开发者工具 4.5.6 已完成本地日志链路实测。**
> 日志通过本地 CDP 适配器采集，不是抖音官方承诺稳定的日志 API。Unity 导出包、macOS、真机日志的覆盖情况见[兼容性表](docs/compatibility.md)。项目为独立社区工具，与抖音/字节跳动无隶属关系。

## 首版只做好这 5 件事

| 工具 | 作用 | 优先级 |
| --- | --- | --- |
| `douyin_open_project` | 官方 `tmg open` 打开指定小游戏并连接对应模拟器 | P0 |
| `douyin_get_logs` | 读取最近的 Console 日志，保留级别和堆栈 | P0 |
| `douyin_get_errors` | 只返回 Error / Exception | P0 |
| `douyin_watch_logs` | 游标增量读取，支持最多 10 秒等待 | P0 |
| `douyin_preview` | 官方 `tmg preview` 生成二维码，返回图片与文件路径 | P1 |

```mermaid
flowchart LR
    A[AI 编程助手] -->|MCP / stdio| B[Douyin DevTools MCP]
    B -->|官方 CLI| C[打开项目 / 生成预览]
    B -->|本机 CDP| D[对应项目的模拟器]
    D -->|Console / Exception| B
    B -->|结构化日志 / 游标 / 堆栈| A
```

没有截图、模拟器点击、自动化 UI 测试、任意脚本执行或自动发布工具。

## 快速开始

需要 Node.js **22 或更高版本**，以及已安装并启动的[抖音开发者工具](https://developer.open-douyin.com/docs/resource/zh-CN/mini-game/develop/dev-tools/developer-instrument-update-and-download)。

克隆仓库并安装：

```sh
git clone https://github.com/linayanc/DouyinDevToolsMCP.git
cd DouyinDevToolsMCP
npm ci
npm run build
npm install -g tt-minigame-ide-cli
node dist/index.js --doctor
```

本仓库尚未发布到 npm。当前请使用本地 `dist/index.js` 接入，不要直接运行同名的陌生 npm 包。官方 CLI 单独安装，便于独立升级与登录。

`--doctor` 检查 Node、CLI 路径和本地调试端口；它不证明某个项目的运行时已连接。具体连接状态由 `douyin_open_project` 返回。

### 接入 Codex

在 Codex 的 `config.toml` 中添加以下配置，把示例路径改为你的仓库绝对路径：

```toml
[mcp_servers.douyin]
command = "node"
args = ["E:/tt-mcp/dist/index.js"]
startup_timeout_sec = 15
tool_timeout_sec = 150
```

若找不到官方 CLI，显式指定其 JavaScript 入口：

```toml
[mcp_servers.douyin.env]
DOUYIN_CLI_PATH = "C:/Users/YOUR_USER/AppData/Roaming/npm/node_modules/tt-minigame-ide-cli/bin/tmg.js"
```

可用 `npm root -g` 查询全局模块目录。配置字段依据 [Codex MCP 官方文档](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)；预览调用可能超过默认超时，因此示例设为 150 秒。

### 其他本地 MCP 客户端

支持 `mcpServers` 配置的客户端可使用：

```json
{
  "mcpServers": {
    "douyin": {
      "command": "node",
      "args": ["/absolute/path/to/tt-mcp/dist/index.js"]
    }
  }
}
```

这需要客户端运行在安装了抖音开发者工具的同一台机器。将客户端工具超时设为至少 150 秒以支持预览。仓库附有[配置示例](examples/mcp.json)。

## 试一次完整工作流

对编程助手说：

> 使用 douyin_open_project 打开我的抖音小游戏导出目录，读取最新错误，依据堆栈定位并修改源码。随后用 douyin_watch_logs 检查新增日志。请先检查连接状态，不要把断线时的空日志解释为问题已经修复。

或先体验仓库里的 `examples/hello-game`。它会主动打印 log、warn、error，抛出一个示例异常，并每 5 秒打印一次 tick。**这些错误是演示数据。** 用其绝对路径调用 `douyin_open_project` 即可。

也可以在源码目录执行真实 MCP 客户端冒烟测试：

```sh
npm run smoke -- /absolute/path/to/tt-mcp/examples/hello-game
```

该命令打开本地项目、读取日志并等待新增日志。它不会调用预览上传。

调用预览前，在终端运行 `tmg login`，确认项目使用有效 AppID 且账号具备权限。`douyin_preview` 会把项目传到抖音生成预览，**不会提审或发布正式版本**。二维码写入系统临时目录，不会写进游戏包；过期后可删除返回路径所在的 `douyin-mcp-preview-*` 目录。仓库演示工程使用测试 AppID，不能作为真实预览验证的依据。

## 日志有什么保证

- 按项目路径匹配工作台，再按 `parentId` 选择模拟器，避免混入另一个项目或 IDE 编辑器日志。
- 采集 `Runtime.consoleAPICalled` / `Runtime.exceptionThrown`；异常若被基础库捕获后打印，会表现为 `error`。
- 默认保留 2,000 条记录；单条文本最多 8,000 字符、堆栈最多 20 帧。溢出和截断会明确返回。
- 返回 `nextCursor`、`hasMore`、`dropped` 与连接状态；增量读取分页不会跳过未返回的匹配记录。
- 每 2 秒尝试断线重连，在有限去重窗口内过滤相同 CDP 事件回放；断线可能缺失日志，会标记 `possibleGapCount`。
- 不对运行时执行 `evaluate` 或读取对象 getter。对象只使用协议提供的预览；原始源码映射尚未实现。

CDP 连接前可能回放部分历史记录，但不能保证拿到 IDE Console 的全部历史。空结果只意味着当前缓存没有匹配记录。

## 配置

| 环境变量 | 默认值 / 说明 |
| --- | --- |
| `DOUYIN_CLI_PATH` | 自动查找 `tt-minigame-ide-cli/bin/tmg.js`；可指定绝对 `.js/.cjs/.mjs/.exe` 路径 |
| `DOUYIN_CDP_ENDPOINT` | 自动从 IDE 日志发现端口；可指定 `http://127.0.0.1:端口` |
| `DOUYIN_IDE_LOG_PATH` | 可指定 IDE 的 `logs/main.log`；仅用于发现调试端口，不当作游戏日志 |
| `DOUYIN_ALLOWED_ROOTS` | 默认 `[]`，可访问任意本地项目；用 JSON 数组限定项目根目录，校验真实路径 |
| `DOUYIN_LOG_CAPACITY` | `2000`；有效范围 `10–10000` |

示例：`DOUYIN_ALLOWED_ROOTS='["E:/games","D:/builds"]'`。环境变量由 MCP 客户端传入；程序不会自动加载 `.env` 文件。

MCP 进程没有遥测；官方 CLI 有独立的配置与行为，参见[官方 CLI 文档](https://partner.open-douyin.com/docs/resource/zh-CN/mini-game/develop/dev-tools/development-assistance/ide-cli)。日志会传给你选择的 AI 客户端。常见 token/password 文本会尽力脱敏，但不能代替应用自身的敏感信息管理。

## 开发与开源

```sh
npm run verify   # 类型检查、单元/集成测试、构建
npm pack --dry-run
```

CI 配置覆盖 Windows、macOS、Linux 上的 Node 22/24 协议与适配器测试；真实 IDE 兼容性单独记录，不以模拟测试替代。

下一阶段优先收集 Unity/Wasm 导出包与不同 IDE 版本的兼容样本，再考虑 source map 和更多运行时适配器。详见 [ROADMAP](ROADMAP.md)。

如果这个工具帮助你少复制一次 Console，欢迎 Star。更有价值的贡献是：一个可复现的兼容性问题、脱敏的目标结构，或一段真实的修复前后演示。

发布准备见[开源发布清单](docs/releasing.md)。MIT License。
