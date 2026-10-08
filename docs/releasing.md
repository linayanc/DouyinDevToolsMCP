# 开源发布清单

目标：让一个陌生开发者在几分钟内跑通“打开小游戏 → 看见错误 → 修复后确认新日志”，再决定是否 Star。

## 发布前

- [x] 创建 GitHub 仓库：[linayanc/DouyinDevToolsMCP](https://github.com/linayanc/DouyinDevToolsMCP)。
- [x] 在 package.json 补充真实 `repository`、`homepage`、`bugs` 链接。
- [ ] 确认 npm 包名是否可用，冲突时使用自己的 scope。
- [ ] 用真实小游戏验证预览上传；记录 IDE/CLI/系统/引擎版本，不提交二维码或账号信息。
- [ ] 验证至少一个 Unity 导出包；未完成前继续保留兼容性限制。
- [x] 本机通过 `npm run verify`（14 项测试）与 `npm pack --dry-run`。
- [x] 检查打包清单仅含构建产物、文档与示例；不包含 `.research`、日志、缓存、密钥、用户配置。
- [ ] 推送后等待三系统 CI 结果，补充真实的 CI badge；不要预先放绿色“通过”状态图。
- [ ] 更新 CHANGELOG，创建 v0.1.0 Release，保留未验证功能说明。

## README 和演示

录制约 45–60 秒的真实操作：

1. 用编程助手打开有一个可复现错误的小项目。
2. 展示 `douyin_get_errors` 返回错误和堆栈。
3. 展示助手修改源码（源码编辑不是 MCP 的工具）。
4. 等待重新编译，调用 `douyin_watch_logs` 展示修复后的新增输出和连接状态。
5. 可选展示真实预览码，发布前遮挡项目身份或使用专门演示账号。

演示必须说明故意注入的错误，避免把示例输出包装成未发生的真实产品案例。上传视频到 GitHub 后，在 README 的工具表之前放演示链接；不需要先堆很多功能。

仓库 About 建议：

> MCP server for Douyin mini games: open projects, read Console errors, follow logs, and generate previews.

Topics 建议：`mcp`、`douyin`、`bytedance`、`mini-game`、`devtools`、`unity`、`codex`、`typescript`。

发布文案草稿：

> 做了一个抖音小游戏开发者工具 MCP。首版只做五件事：打开项目、读日志、读错误、跟踪新增日志、官方 CLI 预览。Windows IDE 4.5.6 的日志链路已实测，Unity/macOS 兼容性正在收集样本。欢迎带脱敏日志和最小工程来测。

## 发布机制

源码托管在 [linayanc/DouyinDevToolsMCP](https://github.com/linayanc/DouyinDevToolsMCP)。推送源码、创建 GitHub Release、发布 npm 包是独立步骤；当前版本尚未创建正式 Release 或发布 npm 包。CI 只检查构建和测试，没有自动发布步骤。包名确认并发布后，再把本地安装说明替换成已经验证的 npm 安装命令。

可在 GitHub 开启 Discussions 收集使用场景，并启用 Private vulnerability reporting。跨平台兼容性报告应与功能愿望分开。Stars 无法保证，最有价值的增长材料是真实可复现的修复演示和明确的支持边界。
