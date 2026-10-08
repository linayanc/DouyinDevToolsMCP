import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli, resolveCli } from '../src/cli.js';
import { validateProject } from '../src/project.js';

test('CLI preserves unicode, spaces and shell metacharacters as literal arguments', async t => {
  const dir = await mkdtemp(path.join(tmpdir(), 'douyin-cli-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const cli = path.join(dir, 'fake.cjs');
  await writeFile(cli, 'console.log(JSON.stringify(process.argv.slice(2)))');
  const args = ['open', '小游戏 & %PATH% $(whoami) `echo nope`', '--mode', 'full'];
  assert.deepEqual(JSON.parse(await runCli(cli, args, 1000)), args);
  await assert.rejects(resolveCli(path.join(dir, 'tmg.cmd')), /not accepted/);
});
test('CLI nonzero exit, timeout and excessive output become tool errors', async t => {
  const dir = await mkdtemp(path.join(tmpdir(), 'douyin-cli-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const cli = path.join(dir, 'fake.cjs');
  await writeFile(cli, "console.error('token=secret');process.exit(1)");
  await assert.rejects(runCli(cli, [], 1000), (error: any) => error.code === 'CLI_FAILED' && !error.message.includes('secret'));
  await writeFile(cli, 'setInterval(()=>{}, 1000)');
  await assert.rejects(runCli(cli, [], 100), (error: any) => error.code === 'CLI_TIMEOUT');
  await writeFile(cli, "process.stdout.write('x'.repeat(300000))");
  await assert.rejects(runCli(cli, [], 1000));
});
test('project validation respects real paths, roots and malformed configurations', async t => {
  const dir = await mkdtemp(path.join(tmpdir(), 'douyin-project-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const allowed = path.join(dir, 'allowed');
  const outside = path.join(dir, 'outside');
  await mkdir(allowed); await mkdir(outside);
  await writeFile(path.join(outside, 'project.config.json'), '{"compileType":"game"}');
  await assert.rejects(validateProject(outside, [allowed]), /outside/);
  await symlink(outside, path.join(allowed, 'link'), process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(validateProject(path.join(allowed, 'link'), [allowed]), /outside/);
  await writeFile(path.join(allowed, 'project.config.json'), '{ invalid');
  await assert.rejects(validateProject(allowed, []), /project.config.json/);
  await writeFile(path.join(allowed, 'project.config.json'), '{"compileType":"game"}');
  assert.ok(await validateProject(allowed, [allowed]));
});
