# Security

This is a local stdio server. It does not expose an HTTP MCP service. It connects only to loopback IDE debugging endpoints and invokes the configured official CLI without a shell.

Project access is unrestricted by default. Set `DOUYIN_ALLOWED_ROOTS` to constrain accessible project roots; paths are checked after resolving symlinks. Your MCP client and local user control the CLI path and environment, which are trusted configuration.

Runtime logs are untrusted data and may contain secrets. Common credential patterns are redacted on a best-effort basis; arbitrary secrets and personal data cannot be recognized reliably. Logs are sent to your selected MCP client. Do not publish unreviewed output. The server itself has no telemetry. The separately installed official CLI has its own dependencies, telemetry configuration, login storage, and upload behavior.

`douyin_preview` sends project code to Douyin. It does not submit for review or publish a release. Cancellation cannot retract an upload that the platform has already received.

Never expose the IDE's debugging port publicly. No credentials, login files, or runtime caches belong in this repository. The server sends only `Runtime.enable` to CDP and does not provide arbitrary code evaluation.

Supported security-fix line: latest 0.1.x. Use [GitHub private vulnerability reporting](https://github.com/linayanc/DouyinDevToolsMCP/security/advisories/new) if it is enabled. Otherwise open an issue asking the maintainer for a private reporting channel without including vulnerability details. Do not post exploit details or secrets in a public issue.
