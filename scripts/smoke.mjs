import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';

const projectPath = process.argv[2];
if (!projectPath || !path.isAbsolute(projectPath)) {
  console.error('Usage: npm run smoke -- <absolute-mini-game-project-path>');
  process.exit(1);
}
const entry = fileURLToPath(new URL('../dist/index.js', import.meta.url));
const client = new Client({ name: 'douyin-live-smoke', version: '0.1.0' });
const transport = new StdioClientTransport({ command: process.execPath, args: [entry], env: process.env, stderr: 'pipe' });
transport.stderr?.on('data', chunk => process.stderr.write(chunk));
try {
  await client.connect(transport);
  const { tools } = await client.listTools();
  assert.equal(tools.length, 5);
  console.log('MCP connected; five tools available.');
  for (const [name, args] of [
    ['douyin_open_project', { projectPath }],
    ['douyin_get_logs', { limit: 10 }],
    ['douyin_get_errors', { limit: 10 }],
    ['douyin_watch_logs', { waitMs: 6000, limit: 10 }],
  ]) {
    const result = await client.callTool({ name, arguments: args });
    assert.ok(!result.isError, `${name}: ${JSON.stringify(result.content)}`);
    const data = result.structuredContent;
    assert.equal(data.connection.state, 'connected', `${name}: runtime not connected`);
    console.log(name, JSON.stringify({ ...data, entries: data.entries?.map(({ id, level, message }) => ({ id, level, message })) }, null, 2));
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await client.close();
}
