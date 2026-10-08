import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { discoverEndpoint, selectRuntime, type Target } from '../src/discovery.js';
import { loadConfig, localUrl } from '../src/config.js';

const project = path.resolve('game');
const workbench = (id: string, projectPath: string): Target => ({ id, type: 'page', url: `file:///ide/applications/microgame-mix/workbench/index.html?projectPath=${encodeURIComponent(projectPath)}` });
const runtime = (id: string, parentId: string): Target => ({ id, parentId, type: 'webview', url: 'http://127.0.0.1:7000/miniapp/index.html?type=microgame', webSocketDebuggerUrl: `ws://127.0.0.1:9000/${id}` });
test('selects only a runtime belonging to the requested project; ignores editor and unrelated games', () => {
  const targets = [workbench('a', project), workbench('b', path.resolve('other')), runtime('ra', 'a'), runtime('rb', 'b'),
    { ...runtime('editor', 'a'), url: 'file:///vscode/workbench.html' }];
  assert.equal(selectRuntime(targets, project).id, 'ra');
  assert.throws(() => selectRuntime(targets, path.resolve('missing')), /No supported/);
  assert.throws(() => selectRuntime([...targets, runtime('ra2', 'a')], project), /Multiple/);
  assert.throws(() => selectRuntime([{...runtime('evil','a'),url:'https://example.com/miniapp/index.html?type=microgame'},workbench('a',project)],project));
});
test('uses latest inspect port from bounded IDE log tail', async t => {
  const dir = await mkdtemp(path.join(tmpdir(), 'douyin-port-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'main.log');
  await writeFile(file, 'x'.repeat(300000) + '\n[IDE INSPECT PORT] 8100\n[IDE INSPECT PORT] 8462\n');
  assert.equal(await discoverEndpoint({ ...loadConfig({}), ideLogPath: file }), 'http://127.0.0.1:8462');
});
test('configuration rejects remote / credential endpoints and invalid retention/roots', () => {
  for (const url of ['http://example.com', 'http://127.0.0.1.evil.test', 'http://user:pw@localhost:1', 'file:///tmp/x']) {
    assert.throws(() => localUrl(url, ['http:']));
  }
  assert.equal(localUrl('http://[::1]:9000', ['http:']).port, '9000');
  assert.throws(() => loadConfig({ DOUYIN_LOG_CAPACITY: 'NaN' }));
  assert.throws(() => loadConfig({ DOUYIN_ALLOWED_ROOTS: '["relative"]' }));
});
