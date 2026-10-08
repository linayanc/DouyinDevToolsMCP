import { execFile } from 'node:child_process';
import { access, realpath } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { ToolError } from './errors.js';

export async function resolveCli(explicit?: string): Promise<string> {
  if (explicit) {
    if (!path.isAbsolute(explicit) || !/\.(?:[cm]?js|exe)$/i.test(explicit)) {
      throw new ToolError('CLI_INVALID', 'DOUYIN_CLI_PATH must be an absolute .js/.cjs/.mjs or .exe path; .cmd/.bat scripts are not accepted.');
    }
    try { await access(explicit); return await realpath(explicit); }
    catch { throw new ToolError('CLI_NOT_FOUND', 'DOUYIN_CLI_PATH does not exist.'); }
  }
  const candidates: string[] = [];
  try { candidates.push(createRequire(import.meta.url).resolve('tt-minigame-ide-cli/bin/tmg.js')); } catch { /* optional external CLI */ }
  for (const entry of (process.env.PATH ?? '').split(path.delimiter).filter(Boolean)) {
    candidates.push(path.join(entry, 'node_modules/tt-minigame-ide-cli/bin/tmg.js'));
    candidates.push(path.resolve(entry, '../lib/node_modules/tt-minigame-ide-cli/bin/tmg.js'));
    try { candidates.push(await realpath(path.join(entry, 'tmg'))); } catch { /* not on this PATH entry */ }
  }
  for (const candidate of candidates) {
    try { await access(candidate); if (/\.[cm]?js$/i.test(candidate)) return await realpath(candidate); } catch { /* next */ }
  }
  throw new ToolError('CLI_NOT_FOUND', 'Official tt-minigame-ide-cli was not found.',
    'Install with npm install -g tt-minigame-ide-cli, or set DOUYIN_CLI_PATH to its bin/tmg.js.');
}

export function runCli(cli: string, args: string[], timeout: number, cwd?: string, signal?: AbortSignal): Promise<string> {
  const isJs = /\.[cm]?js$/i.test(cli);
  return new Promise((resolve, reject) => {
    execFile(isJs ? process.execPath : cli, isJs ? [cli, ...args] : args, {
      cwd, timeout, signal, maxBuffer: 256 * 1024, windowsHide: true, shell: false,
      env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' }, encoding: 'utf8',
    }, (error, stdout, stderr) => {
      if (error) {
        if (signal?.aborted) { reject(new ToolError('CANCELLED', 'CLI operation was cancelled.')); return; }
        const output = redact(`${stdout}\n${stderr}`).slice(-8000);
        reject(new ToolError(error.killed ? 'CLI_TIMEOUT' : 'CLI_FAILED',
          `${error.killed ? 'Official CLI timed out' : 'Official CLI failed'}: ${output || error.message}`,
          'Check tmg login in your terminal and the project configuration. Preview needs a real AppID and permission.'));
      } else resolve(redact(`${stdout}\n${stderr}`).trim().slice(-16000));
    }).stdin?.end();
  });
}

export function redact(text: string): string {
  return text.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '')
    .replace(/((?:access_token|refresh_token|authorization|password|wsToken|token)\s*[=:]\s*)([^\s&,;]+)/gi, '$1[REDACTED]')
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [REDACTED]');
}
