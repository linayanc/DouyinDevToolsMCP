import { open } from 'node:fs/promises';
import path from 'node:path';
import { type Config, defaultIdeLogs, localUrl } from './config.js';
import { ToolError } from './errors.js';

export interface Target {
  id: string;
  parentId?: string;
  type: string;
  title?: string;
  url: string;
  webSocketDebuggerUrl?: string;
}

export async function discoverEndpoint(config: Config): Promise<string> {
  if (config.endpoint) return localUrl(config.endpoint, ['http:']).origin;
  for (const file of config.ideLogPath ? [config.ideLogPath] : defaultIdeLogs()) {
    try {
      const handle = await open(file, 'r');
      let tail: string;
      try {
        const { size } = await handle.stat();
        const buffer = Buffer.alloc(Math.min(size, 256 * 1024));
        const { bytesRead } = await handle.read(buffer, 0, buffer.length, Math.max(0, size - buffer.length));
        tail = buffer.subarray(0, bytesRead).toString('utf8');
      } finally { await handle.close(); }
      const matches = [...tail.matchAll(/\[IDE INSPECT PORT\]\s+(\d+)/g)];
      const port = Number(matches.at(-1)?.[1]);
      if (port > 0 && port < 65536) return `http://127.0.0.1:${port}`;
    } catch { /* another supported installation */ }
  }
  throw new ToolError('CDP_NOT_FOUND', 'Cannot discover the Douyin IDE debugging port.',
    'Start Douyin DevTools, or set DOUYIN_CDP_ENDPOINT=http://127.0.0.1:<port>. See docs/compatibility.md.');
}

export async function listTargets(endpoint: string): Promise<Target[]> {
  const url = localUrl(endpoint, ['http:']);
  const response = await fetch(new URL('/json/list', url), { signal: AbortSignal.timeout(3000), redirect: 'error' });
  if (!response.ok) throw new ToolError('CDP_UNAVAILABLE', `Debugging endpoint returned HTTP ${response.status}.`);
  // Bound the response before parsing; simulator URLs can be relatively large.
  const reader = response.body?.getReader();
  if (!reader) throw new ToolError('CDP_INVALID', 'Empty target response.');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 2 * 1024 * 1024) throw new ToolError('CDP_INVALID', 'Target response exceeds 2 MiB.');
      chunks.push(value);
    }
  } finally { await reader.cancel(); }
  const data: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  if (!Array.isArray(data)) throw new ToolError('CDP_INVALID', 'Expected a CDP target list.');
  return data.filter((t): t is Target => t && typeof t.id === 'string' && typeof t.type === 'string' && typeof t.url === 'string');
}

function normalizeProject(value: string): string {
  const normalized = path.normalize(value).replace(/[\\/]+$/, '');
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized;
}

export function selectRuntime(targets: Target[], project: string): Target {
  const workbenches = targets.filter(t => {
    try {
      const url = new URL(t.url);
      const projectPath = url.searchParams.get('projectPath');
      return url.protocol === 'file:' && /\/applications\/microgame[^/]*\/workbench\//.test(url.pathname)
        && projectPath !== null && normalizeProject(projectPath) === normalizeProject(project);
    } catch { return false; }
  });
  const parents = new Set(workbenches.map(t => t.id));
  const candidates = targets.filter(t => {
    try {
      const url = new URL(t.url);
      return !!t.parentId && parents.has(t.parentId) && !!t.webSocketDebuggerUrl
        && ['webview', 'page'].includes(t.type) && url.pathname === '/miniapp/index.html'
        && url.searchParams.get('type') === 'microgame'
        && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    } catch { return false; }
  });
  if (candidates.length !== 1) throw new ToolError(candidates.length ? 'RUNTIME_AMBIGUOUS' : 'RUNTIME_NOT_FOUND',
    candidates.length ? 'Multiple simulator runtimes belong to this project.' : 'No supported simulator runtime found for this project.',
    'Open the project in full mode and wait for the simulator. Close duplicate project windows. Unity/native runtimes may use an unsupported target layout.');
  return candidates[0]!;
}
