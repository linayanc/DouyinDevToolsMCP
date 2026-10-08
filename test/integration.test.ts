import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, realpath, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { WebSocketServer } from 'ws';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { DouyinService } from '../src/service.js';
import { loadConfig } from '../src/config.js';

const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j2V8AAAAASUVORK5CYII=';
const event = (text: string, timestamp: number, type = 'log') => ({ method: 'Runtime.consoleAPICalled', params: {
  type, timestamp, args: [{ type: 'string', value: text }],
} });

async function fixture(t: { after: (fn: () => unknown) => void }) {
  // macOS may alias /var to /private/var; match the service's canonical project path.
  const project = await realpath(await mkdtemp(path.join(tmpdir(), 'douyin integration & 中文 ')));
  await writeFile(path.join(project, 'project.config.json'), '{"compileType":"game"}');
  const cli = path.join(project, 'fake-cli.cjs');
  await writeFile(cli, `const fs=require('node:fs');const a=process.argv.slice(2);if(a[0]==='preview'){fs.writeFileSync(a[a.indexOf('--output')+1],Buffer.from('${png}','base64'));}console.log('ok');`);
  const history = [event('ready', 1000), event('warning', 2000, 'warning'), event('broken', 3000, 'error'), {
    method: 'Runtime.exceptionThrown', params: { timestamp: 4000, exceptionDetails: { text: 'Uncaught', exception: { description: 'Error: boom' } } },
  }];
  const http = createServer((_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify([
      { id: 'workbench', type: 'page', url: `file:///ide/applications/microgame-mix/workbench/index.html?projectPath=${encodeURIComponent(project)}` },
      { id: 'runtime', parentId: 'workbench', type: 'webview', url: 'http://127.0.0.1:7777/miniapp/index.html?type=microgame', webSocketDebuggerUrl: `${endpoint.replace('http:', 'ws:')}/runtime` },
      { id: 'unrelated', type: 'page', url: 'https://example.com', webSocketDebuggerUrl: `${endpoint.replace('http:', 'ws:')}/wrong` },
    ]));
  });
  const wss = new WebSocketServer({ server: http });
  let connections = 0;
  wss.on('connection', (ws, req) => {
    connections++;
    assert.equal(req.url, '/runtime');
    ws.on('message', bytes => {
      const command = JSON.parse(bytes.toString());
      assert.equal(command.method, 'Runtime.enable');
      for (const item of history) ws.send(JSON.stringify(item));
      ws.send(JSON.stringify({ id: command.id, result: {} }));
    });
  });
  await new Promise<void>(resolve => http.listen(0, '127.0.0.1', resolve));
  const address = http.address();
  if (!address || typeof address === 'string') throw new Error('Missing server address');
  const endpoint = `http://127.0.0.1:${address.port}`;
  t.after(async () => {
    for (const ws of wss.clients) ws.terminate();
    await new Promise<void>(resolve => wss.close(() => resolve()));
    await new Promise<void>(resolve => http.close(() => resolve()));
    await rm(project, { recursive: true, force: true });
  });
  return { project, cli, endpoint, history, wss, connections: () => connections,
    broadcast(item: ReturnType<typeof event>) { history.push(item); for (const ws of wss.clients) ws.send(JSON.stringify(item)); } };
}

test('service captures errors, paginates, watches, reconnects without replay duplicates, and resets sessions', async t => {
  const f = await fixture(t);
  const service = new DouyinService({ ...loadConfig({}), cliPath: f.cli, endpoint: f.endpoint });
  t.after(() => service.close());
  await assert.rejects(service.read(), /douyin_open_project/);
  const opened = await service.openProject(f.project);
  assert.equal(opened.connection.state, 'connected');
  const errors = await service.read({}, true);
  assert.deepEqual(errors.entries.map(e => e.level), ['error', 'exception']);
  const baseline = errors.nextCursor;
  assert.equal((await service.watch()).entries.length, 0);
  const pending = service.watch({ waitMs: 1000 });
  setTimeout(() => f.broadcast(event('new log', 5000)), 50);
  assert.equal((await pending).entries[0]?.message, 'new log');
  // Explicit cursor is independently repeatable and does not consume the default cursor.
  assert.equal((await service.watch({ cursor: baseline })).entries[0]?.message, 'new log');
  assert.equal((await service.watch({ cursor: baseline })).entries[0]?.message, 'new log');
  assert.equal((await service.watch()).entries.length, 0);
  for (const ws of f.wss.clients) ws.terminate();
  await delay(50);
  const reconnected = await service.read();
  assert.equal(reconnected.connection.state, 'connected');
  assert.equal(reconnected.connection.possibleGapCount, 1);
  assert.equal(f.connections(), 2);
  assert.equal(reconnected.entries.length, 5);
  await service.openProject(f.project);
  await assert.rejects(service.watch({ cursor: baseline }), /another project/);
  const controller = new AbortController();
  const wait = service.watch({ waitMs: 1000, contains: 'never' }, controller.signal);
  controller.abort();
  await assert.rejects(wait, /abort/i);
});

test('preview invokes the official command contract and returns an image outside the project', async t => {
  const f = await fixture(t);
  const service = new DouyinService({ ...loadConfig({}), cliPath: f.cli });
  t.after(() => service.close());
  const preview = await service.preview(f.project, true);
  const outputDir = path.dirname(preview.qrCodePath);
  t.after(() => rm(outputDir, { recursive: true, force: true }));
  assert.equal(preview.image, png);
  assert.ok(!preview.qrCodePath.startsWith(f.project));
  await writeFile(f.cli, "console.log('pretend success')");
  await assert.rejects(service.preview(f.project), (error: any) => error.code === 'PREVIEW_OUTPUT_MISSING');
});

test('real stdio MCP handshake lists exactly five tools, validates inputs and returns structured results', async t => {
  const f = await fixture(t);
  const transport = new StdioClientTransport({ command: process.execPath,
    args: ['--import', 'tsx', path.resolve('src/index.ts')],
    env: { ...process.env, DOUYIN_CLI_PATH: f.cli, DOUYIN_CDP_ENDPOINT: f.endpoint } as Record<string, string>, stderr: 'pipe' });
  const client = new Client({ name: 'integration-test', version: '1.0.0' });
  t.after(() => client.close());
  await client.connect(transport);
  const listed = await client.listTools();
  assert.deepEqual(listed.tools.map(tool => tool.name), [
    'douyin_open_project', 'douyin_get_logs', 'douyin_get_errors', 'douyin_watch_logs', 'douyin_preview',
  ]);
  const call = (name: string, args: Record<string, unknown> = {}) => client.callTool({ name, arguments: args });
  assert.equal((await call('douyin_get_logs')).isError, true);
  const opened = await call('douyin_open_project', { projectPath: f.project });
  assert.ok(!opened.isError);
  const logs = await call('douyin_get_logs');
  assert.equal((logs.structuredContent as any).entries.length, 4);
  const errors = await call('douyin_get_errors');
  assert.equal((errors.structuredContent as any).entries.length, 2);
  const validation = await call('douyin_get_logs', { limit: 0 });
  assert.equal(validation.isError, true);
  const preview = await call('douyin_preview');
  assert.equal((preview.content as any[]).some(c => c.type === 'image'), true);
  const outputDir = path.dirname((preview.structuredContent as any).qrCodePath);
  t.after(() => rm(outputDir, { recursive: true, force: true }));
  await client.close();
});
