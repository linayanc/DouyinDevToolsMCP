# Security

This is a local stdio server. It does not expose an HTTP MCP service. It connects only to loopback IDE debugging endpoints and invokes the configured official CLI without a shell.

Project access is unrestricted by default. Set `DOUYIN_ALLOWED_ROOTS` to constrain accessible project roots; paths are checked after resolving symlinks. Your MCP client and local user control the CLI path and environment, which are trusted configuration.

Runtime logs are untrusted data and may contain secrets. Common credential patterns are redacted on a best-effort basis; arbitrary secrets and personal data cannot be recognized reliably. Logs are sent to your selected MCP client. Do not publish unreviewed output. The server itself has no telemetry. The separately installed official CLI has its own dependencies, telemetry configuration, login storage, and upload behavior.

`douyin_preview` sends project code to Douyin. It does not submit for review or publish a release. Cancellation cannot retract an upload that the platform has already received.

Never expose the IDE's debugging port publicly. No credentials, login files, or runtime caches belong in this repository. The server sends only `Runtime.enable` to CDP and does not provide arbitrary code evaluation.

## Reporting a vulnerability

Supported security-fix line: latest 0.1.x.

Email [1772997956@qq.com](mailto:1772997956@qq.com) with the subject `DouyinDevToolsMCP security report`. Reports in Chinese or English are welcome. Include the affected version, impact, and minimal reproduction steps, with credentials and personal information removed. Please do not post exploit details or secrets in a public issue.

You can also use [GitHub private vulnerability reporting](https://github.com/linayanc/DouyinDevToolsMCP/security/advisories/new) if it is enabled for the repository. General bugs and feature requests belong in [GitHub Issues](https://github.com/linayanc/DouyinDevToolsMCP/issues).

安全漏洞请通过 [1772997956@qq.com](mailto:1772997956@qq.com) 私下联系，说明受影响版本、影响范围和最小复现步骤。请先移除账号、令牌和个人信息，不要在公开 Issue 中披露漏洞利用细节。
