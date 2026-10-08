# Contributing

欢迎中文或英文贡献。最需要的是不同 IDE 版本、macOS、Unity/Wasm 导出包的可复现兼容性证据。

```sh
npm ci
npm run verify
```

自动化测试无需账号、抖音 IDE 或网络服务，不进行上传。`npm run smoke -- <absolute-project-path>` 是另一个可选的真实 IDE 测试，会打开指定本地项目。

## 修改约定

- 保持五个首版工具的命名与优先级。新能力先给出真实场景。
- CDP 目标必须能关联到指定项目；不能简单附着第一个 page/worker。
- 只使用参数数组启动官方 CLI，禁止 shell 命令拼接。
- stdout 是 MCP 协议通道。诊断输出使用 stderr。
- 对断线、缓存溢出、超时、未支持版本返回明确信息，不伪造成功或日志。
- 新增适配器时附脱敏测试数据与版本说明；不复制 IDE 的私有实现。
- 修复协议、分页、项目隔离等行为时添加回归测试；修改文档不需要无意义测试。

## Pull request

说明实际问题、结果行为、验证方法与尚未覆盖的平台。确保 `npm run verify` 通过。真实运行时测试和 mock 测试分开报告。

## 报告问题

提供系统、Node、IDE、官方 CLI 版本，`--doctor` 的脱敏输出、工具错误码，以及最小复现步骤。不要公开完整 CDP URL 查询串、访问令牌、账号信息、项目私密源代码或预览码。

安全问题见 [SECURITY.md](SECURITY.md)。贡献默认采用项目的 MIT 许可。
