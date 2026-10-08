import { mkdtemp, readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { CdpConnection } from './cdp.js';
import { resolveCli, runCli, redact } from './cli.js';
import type { Config } from './config.js';
import { discoverEndpoint, listTargets, selectRuntime } from './discovery.js';
import { errorMessage, ToolError } from './errors.js';
import { LogStore, type Query } from './logs.js';
import { validateProject } from './project.js';

export class DouyinService {
  private project?: string;
  private store: LogStore;
  private connection?: CdpConnection;
  private targetId?: string;
  private attaching?: Promise<void>;
  private ticker?: NodeJS.Timeout;
  private closed = false;
  private everConnected = false;
  private gaps = 0;
  private lastError?: string;
  private baseline = 0;
  private queue: Promise<unknown> = Promise.resolve();
  private shutdown = new AbortController();
  constructor(readonly config: Config) { this.store = new LogStore(config.capacity); }

  // An MCP host may send parallel calls. Serialize project changes and default cursor updates.
  exclusive<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.queue.then(operation);
    this.queue = result.catch(() => {});
    return result;
  }

  private status() {
    return { state: this.connection?.connected ? 'connected' : 'disconnected', targetId: this.targetId,
      source: 'simulator-cdp', possibleGapCount: this.gaps, lastError: this.lastError };
  }

  async openProject(input: string, mode: 'full' | 'lite' = 'full') {
    const project = await validateProject(input, this.config.allowedRoots);
    const cli = await resolveCli(this.config.cliPath);
    const output = await runCli(cli, ['open', project, '--mode', mode], 20000, project, this.shutdown.signal);
    if (this.ticker) clearInterval(this.ticker);
    // Do not allow an old attach operation to write into a new project session.
    await this.attaching;
    this.connection?.close();
    this.connection = undefined;
    this.project = project;
    this.store = new LogStore(this.config.capacity);
    this.baseline = 0;
    this.gaps = 0;
    this.everConnected = false;
    this.targetId = undefined;
    this.lastError = undefined;
    const deadline = Date.now() + 10000;
    do {
      await this.ensureConnection();
      if (this.status().state === 'connected') break;
      await delay(300);
    } while (Date.now() < deadline && !this.closed);
    this.shutdown.signal.throwIfAborted();
    this.ticker = setInterval(() => { void this.ensureConnection(); }, 2000);
    this.ticker.unref();
    return { opened: true, projectPath: project, mode, connection: this.status(), output,
      warning: this.everConnected ? undefined : 'IDE open was requested, but runtime log capture is not connected yet. Check connection.lastError.' };
  }

  private async attach(): Promise<void> {
    if (!this.project || this.closed || this.connection?.connected) return;
    let connection: CdpConnection | undefined;
    try {
      const endpoint = await discoverEndpoint(this.config);
      const target = selectRuntime(await listTargets(endpoint), this.project);
      if (this.closed) return;
      connection = new CdpConnection();
      const store = this.store;
      connection.onEvent = event => store.append(event, target.id);
      connection.onDisconnect = () => { this.gaps++; this.lastError = 'Simulator disconnected; reconnecting. Logs during the gap may be unavailable.'; };
      this.connection = connection;
      await connection.connect(target.webSocketDebuggerUrl!);
      await connection.enableRuntime();
      if (this.closed) { connection.close(); return; }
      this.targetId = target.id;
      this.everConnected = true;
      this.lastError = undefined;
    } catch (error) {
      connection?.close();
      this.lastError = redact(errorMessage(error));
    }
  }

  private ensureConnection(): Promise<void> {
    if (!this.attaching) this.attaching = this.attach().finally(() => { this.attaching = undefined; });
    return this.attaching;
  }

  async read(query: Query = {}, errorsOnly = false) {
    await this.prepareRead();
    const result = this.store.snapshot(errorsOnly ? { ...query, levels: ['error', 'exception'] } : query);
    this.baseline = this.store.parseCursor(result.nextCursor);
    return { projectPath: this.project, ...result, connection: this.status() };
  }

  async watch(query: Query & { cursor?: string; waitMs?: number } = {}, signal?: AbortSignal) {
    await this.prepareRead();
    let after = query.cursor ? this.store.parseCursor(query.cursor) : this.baseline;
    const deadline = Date.now() + (query.waitMs ?? 0);
    let result = this.store.since(after, query);
    let dropped = result.dropped;
    while (!result.entries.length && Date.now() < deadline && !this.closed) {
      signal?.throwIfAborted();
      after = this.store.parseCursor(result.nextCursor);
      await delay(Math.min(100, Math.max(1, deadline - Date.now())), undefined, { signal });
      result = this.store.since(after, query);
      dropped += result.dropped;
    }
    signal?.throwIfAborted();
    if (!query.cursor) this.baseline = this.store.parseCursor(result.nextCursor);
    return { projectPath: this.project, ...result, dropped, connection: this.status() };
  }

  private async prepareRead(): Promise<void> {
    if (!this.project) throw new ToolError('PROJECT_NOT_OPEN', 'Call douyin_open_project before reading logs.');
    await this.ensureConnection();
    if (!this.everConnected) throw new ToolError('RUNTIME_NOT_CONNECTED', this.lastError ?? 'Simulator is not connected.');
  }

  async preview(input?: string, disableCache = false) {
    const project = input ? await validateProject(input, this.config.allowedRoots) : this.project;
    if (!project) throw new ToolError('PROJECT_NOT_OPEN', 'Provide projectPath or call douyin_open_project first.');
    const cli = await resolveCli(this.config.cliPath);
    const directory = await mkdtemp(path.join(tmpdir(), 'douyin-mcp-preview-'));
    const qrCodePath = path.join(directory, 'preview.png');
    const args = ['preview', project, '--output', qrCodePath];
    if (disableCache) args.push('--disable-cache');
    const output = await runCli(cli, args, 120000, project, this.shutdown.signal);
    let bytes: Buffer;
    try {
      const info = await stat(qrCodePath);
      if (!info.isFile() || info.size > 4 * 1024 * 1024) throw new Error('Invalid QR size');
      bytes = await readFile(qrCodePath);
      if (!bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) throw new Error('Not PNG');
    } catch {
      throw new ToolError('PREVIEW_OUTPUT_MISSING', 'Official CLI finished without a valid PNG QR code.', 'Check CLI output manually and confirm login / preview permissions.');
    }
    return { projectPath: project, qrCodePath, output, image: bytes.toString('base64') };
  }

  close(): void {
    this.closed = true;
    this.shutdown.abort();
    if (this.ticker) clearInterval(this.ticker);
    this.connection?.close();
  }
}
