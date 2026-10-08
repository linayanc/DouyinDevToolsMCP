# Douyin DevTools MCP

**Give your AI coding assistant access to Douyin mini-game Console logs.**

[简体中文](README.md) · [Tool reference](docs/tools.md) · [Compatibility](docs/compatibility.md)

Open a mini-game project, inspect errors and stack traces, read new logs after a fix, and generate a preview QR code through the official CLI. Your coding assistant edits source files; this MCP server supplies runtime evidence and IDE operations.

Independent community project. Not affiliated with Douyin or ByteDance. This targets **Douyin mini games**, not TikTok Mini Games or WeChat DevTools.

| Tool | Purpose | Priority |
| --- | --- | --- |
| `douyin_open_project` | Open an exported mini-game project and attach to its simulator | P0 |
| `douyin_get_logs` | Read recent Console entries and stacks | P0 |
| `douyin_get_errors` | Return errors and exceptions only | P0 |
| `douyin_watch_logs` | Read incremental logs, with optional bounded polling | P0 |
| `douyin_preview` | Generate a preview QR image using the official CLI | P1 |

## Get started

Requires Node.js 22+, Douyin DevTools running locally, and the official mini-game CLI.

Clone the repository and install:

```sh
git clone https://github.com/linayanc/DouyinDevToolsMCP.git
cd DouyinDevToolsMCP
npm ci
npm run build
npm install -g tt-minigame-ide-cli
node dist/index.js --doctor
```

This project has not been published to npm. Use the local entry point, rather than an unverified package with the same name.

For local MCP clients supporting `mcpServers`:

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

For Codex, add to `config.toml`:

```toml
[mcp_servers.douyin]
command = "node"
args = ["/absolute/path/to/tt-mcp/dist/index.js"]
tool_timeout_sec = 150
```

See [official Codex MCP configuration](https://learn.chatgpt.com/docs/extend/mcp?surface=cli). If CLI discovery fails, set `DOUYIN_CLI_PATH` to the absolute `tt-minigame-ide-cli/bin/tmg.js` path under `npm root -g`. Use a 150-second client tool timeout for preview operations.

Try: “Open my exported Douyin mini-game project, read the latest errors, fix the relevant source, then check new logs. Check the connection status before concluding that the errors are gone.”

The included `examples/hello-game` intentionally prints messages, errors, and an exception. Run `npm run smoke -- /absolute/path/to/examples/hello-game` for a live MCP smoke test without uploading anything.

Before previewing a real project, run `tmg login` in your terminal and use a valid AppID with preview permission. Preview **uploads project code to Douyin**; it does not submit or publish a release. QR images are stored in unique system temporary directories, outside the project.

## Status and boundaries

Windows + Douyin DevTools 4.5.6 + official CLI 2.1.1 were locally tested for project opening and runtime logs. Preview command/PNG handling is integration-tested with a fixture, but a live authenticated preview has not been validated. macOS IDE integration and Unity/Wasm exports need real-world validation. Linux CI validates protocol logic only.

Logging uses the IDE's local CDP endpoint, an implementation detail rather than a supported official logging API. Only a simulator matched through the requested project's workbench is attached. Unsupported layouts return actionable errors instead of silently collecting another target's logs. Device debugging and arbitrary workers are not supported in v0.1.0.

Logs remain in a bounded in-memory buffer (2,000 entries by default). Results include cursors, overflow counts, stack frames, and connection state. Reconnection attempts run every two seconds; finite event deduplication handles recent replay, but gaps may lose events. History before attachment is best effort. An empty result is not proof that the game has no errors.

Only `Runtime.enable` is sent over CDP. No screenshots, simulator clicks, arbitrary evaluation, code edits, or release publishing tools. No server telemetry. Log content is sent to your configured AI client; best-effort redaction is not a guarantee that secrets will never appear. The official CLI has its own behavior and configuration.

Environment variables: `DOUYIN_CLI_PATH`, `DOUYIN_CDP_ENDPOINT`, `DOUYIN_IDE_LOG_PATH`, `DOUYIN_ALLOWED_ROOTS` (JSON array of absolute paths; default unrestricted), `DOUYIN_LOG_CAPACITY` (10–10,000). `.env` files are not automatically loaded.

## Contribute

```sh
npm run verify
npm pack --dry-run
```

See [CONTRIBUTING](CONTRIBUTING.md), [ROADMAP](ROADMAP.md), and the [release checklist](docs/releasing.md). Compatibility reports and reproducible examples are especially welcome. If this saves you a round of copying Console logs, consider leaving a star.

MIT License.
