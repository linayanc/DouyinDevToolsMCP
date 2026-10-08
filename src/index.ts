#!/usr/bin/env node
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { loadConfig } from './config.js';
import { resolveCli } from './cli.js';
import { discoverEndpoint, listTargets } from './discovery.js';
import { errorMessage } from './errors.js';
import { createServer, VERSION } from './server.js';
import { DouyinService } from './service.js';

async function main() {
  if (process.argv.includes('--version')) { console.log(VERSION); return; }
  if (process.argv.includes('--help')) {
    console.log(`douyin-devtools-mcp ${VERSION}\n\nUsage: douyin-devtools-mcp [--doctor | --version | --help]\nDefault: MCP server over stdio.\n\nEnvironment:\n  DOUYIN_CLI_PATH       Absolute path to official bin/tmg.js\n  DOUYIN_CDP_ENDPOINT   Optional http://127.0.0.1:<port>\n  DOUYIN_IDE_LOG_PATH   Optional IDE logs/main.log for port discovery\n  DOUYIN_ALLOWED_ROOTS  JSON array of allowed absolute project roots\n  DOUYIN_LOG_CAPACITY   Retained entries (10–10000; default 2000)\n`);
    return;
  }
  const config = loadConfig();
  if (process.argv.includes('--doctor')) {
    const checks: Record<string, unknown> = { node: process.version, platform: process.platform };
    let ok = true;
    try { checks.cli = await resolveCli(config.cliPath); } catch (error) { checks.cliError = errorMessage(error); ok = false; }
    try {
      checks.endpoint = await discoverEndpoint(config);
      const targets = await listTargets(String(checks.endpoint));
      checks.targetCount = targets.length;
      checks.note = 'Endpoint reachable. Use douyin_open_project to verify project-specific runtime capture.';
    } catch (error) { checks.runtimeError = errorMessage(error); ok = false; }
    console.log(JSON.stringify({ ok, ...checks }, null, 2));
    if (!ok) process.exitCode = 1;
    return;
  }
  if (process.argv.length > 2) throw new Error('Unknown arguments. Use --help.');
  const service = new DouyinService(config);
  const handle = serveStdio(() => createServer(service), { onerror: error => console.error(errorMessage(error)) });
  const close = () => { service.close(); void handle.close(); };
  process.stdin.once('end', close);
  process.once('SIGINT', close);
  process.once('SIGTERM', close);
}
main().catch(error => { console.error(errorMessage(error)); process.exitCode = 1; });
