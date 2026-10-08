import { homedir } from 'node:os';
import path from 'node:path';
import { ToolError } from './errors.js';

export interface Config {
  cliPath?: string;
  endpoint?: string;
  ideLogPath?: string;
  allowedRoots: string[];
  capacity: number;
}

export function loadConfig(env = process.env): Config {
  let roots: unknown = [];
  try { roots = JSON.parse(env.DOUYIN_ALLOWED_ROOTS ?? '[]'); }
  catch { throw new ToolError('CONFIG_INVALID', 'DOUYIN_ALLOWED_ROOTS must be a JSON array of absolute paths.'); }
  if (!Array.isArray(roots) || !roots.every(r => typeof r === 'string' && path.isAbsolute(r))) {
    throw new ToolError('CONFIG_INVALID', 'DOUYIN_ALLOWED_ROOTS must contain absolute paths.');
  }
  const capacity = Number(env.DOUYIN_LOG_CAPACITY ?? 2000);
  if (!Number.isInteger(capacity) || capacity < 10 || capacity > 10000) {
    throw new ToolError('CONFIG_INVALID', 'DOUYIN_LOG_CAPACITY must be an integer from 10 to 10000.');
  }
  if (env.DOUYIN_CDP_ENDPOINT) localUrl(env.DOUYIN_CDP_ENDPOINT, ['http:']);
  return { cliPath: env.DOUYIN_CLI_PATH, endpoint: env.DOUYIN_CDP_ENDPOINT,
    ideLogPath: env.DOUYIN_IDE_LOG_PATH, allowedRoots: roots, capacity };
}

export function localUrl(value: string, protocols: string[]): URL {
  let url: URL;
  try { url = new URL(value); }
  catch { throw new ToolError('ENDPOINT_INVALID', 'Invalid local debugging URL.'); }
  if (!protocols.includes(url.protocol) || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)
    || url.username || url.password) {
    throw new ToolError('ENDPOINT_INVALID', 'Only loopback debugging endpoints without credentials are supported.');
  }
  return url;
}

export function defaultIdeLogs(): string[] {
  const bases = process.platform === 'win32'
    ? [path.join(process.env.APPDATA ?? path.join(homedir(), 'AppData', 'Roaming'), '@byted')]
    : [path.join(homedir(), 'Library', 'Application Support', '@byted'), path.join(homedir(), '.config', '@byted')];
  return bases.flatMap(base => ['vela', 'miniprogram-ide'].map(name => path.join(base, name, 'logs', 'main.log')));
}
