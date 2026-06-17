import * as fs from 'fs';
import * as path from 'path';
import type { ParsedNetworkEvent } from './types';

/**
 * Disk-backed store for the *heavy* part of captured network events (request/response headers
 * and bodies). The in-memory buffer keeps only lightweight summaries; the full event is written
 * here so memory stays flat even during heavy video capture. Records are looked up on demand
 * (when the user focuses a request) and the whole file is deleted when capture stops or RDS quits.
 *
 * Format: a single append-only file. Each record is a UTF-8 JSON blob written at a tracked byte
 * offset; an in-memory `index` maps event id → {offset, length} for O(1) positional reads. Writes
 * are queued and performed asynchronously off the capture hot path; very recent records are also
 * held in `pending` so a read that races ahead of the flush is still served from memory.
 *
 * The file is a temp artifact: it grows for the session and is unlinked on dispose. A soft size
 * ceiling stops writing new details (rather than filling the disk) — those events simply report
 * `detailAvailable: false`.
 */

const CACHE_DIR_NAME = 'network-inspector-cache';
const FILE_PREFIX = 'detail-';
const FILE_SUFFIX = '.ndjson';
// Stop persisting new detail past this on-disk size to avoid filling the user's disk during an
// extreme session. 2 GB of temp cache is generous; beyond it new events lose their stored detail.
const MAX_FILE_BYTES = 2 * 1024 * 1024 * 1024;

type IndexEntry = { offset: number; length: number };

export class NetworkDetailStore {
  private readonly cacheDir: string;
  private filePath: string | null = null;
  private fd: number | null = null;
  private writeOffset = 0;
  private readonly index = new Map<string, IndexEntry>();
  private readonly pending = new Map<string, Buffer>();
  private readonly queue: Array<{ id: string; buf: Buffer }> = [];
  private draining = false;
  private disposed = false;
  private capped = false;

  constructor(baseDir: string) {
    this.cacheDir = path.join(baseDir, CACHE_DIR_NAME);
  }

  /**
   * Remove any leftover cache files from a previous (possibly crashed) session. Safe to call on
   * startup before any capture begins — only one capture session exists at a time.
   */
  static cleanupBaseDir(baseDir: string): void {
    const dir = path.join(baseDir, CACHE_DIR_NAME);
    try {
      if (!fs.existsSync(dir)) return;
      for (const name of fs.readdirSync(dir)) {
        if (name.startsWith(FILE_PREFIX) && name.endsWith(FILE_SUFFIX)) {
          try {
            fs.unlinkSync(path.join(dir, name));
          } catch {
            /* ignore individual file errors */
          }
        }
      }
    } catch {
      /* ignore — cleanup is best-effort */
    }
  }

  private ensureOpen(): boolean {
    if (this.disposed) return false;
    if (this.fd != null) return true;
    try {
      fs.mkdirSync(this.cacheDir, { recursive: true });
      this.filePath = path.join(
        this.cacheDir,
        `${FILE_PREFIX}${process.pid}-${Date.now()}${FILE_SUFFIX}`
      );
      // 'w+' truncates/creates and allows positional reads + writes.
      this.fd = fs.openSync(this.filePath, 'w+');
      this.writeOffset = 0;
      return true;
    } catch {
      this.fd = null;
      this.filePath = null;
      return false;
    }
  }

  /** Queue the full event for persistence. Returns false when detail won't be available on disk. */
  put(event: ParsedNetworkEvent): boolean {
    if (this.disposed || this.capped) return false;
    if (this.writeOffset > MAX_FILE_BYTES) {
      this.capped = true;
      return false;
    }
    let buf: Buffer;
    try {
      buf = Buffer.from(JSON.stringify(event), 'utf8');
    } catch {
      return false;
    }
    // Overwrite-in-place semantics for updates (e.g. MITM Pending → 200): the newest write wins
    // via the index; the superseded bytes become dead space in the append-only file.
    this.pending.set(event.id, buf);
    this.queue.push({ id: event.id, buf });
    void this.drain();
    return true;
  }

  private async drain(): Promise<void> {
    if (this.draining) return;
    this.draining = true;
    try {
      while (this.queue.length > 0) {
        const next = this.queue.shift();
        if (!next) break;
        if (this.disposed) break;
        if (!this.ensureOpen() || this.fd == null) {
          this.pending.delete(next.id);
          continue;
        }
        const offset = this.writeOffset;
        this.writeOffset += next.buf.length;
        try {
          await this.writeAt(this.fd, next.buf, offset);
          // Only index if the id is still wanted (not evicted while in flight).
          if (this.pending.has(next.id)) {
            this.index.set(next.id, { offset, length: next.buf.length });
          }
        } catch {
          /* a failed write just means this id won't be readable from disk */
        } finally {
          // Keep the freshest buffer in `pending` if a newer write for the same id queued after
          // us; otherwise drop it now that it's on disk.
          if (this.queue.every((q) => q.id !== next.id)) this.pending.delete(next.id);
        }
      }
    } finally {
      this.draining = false;
    }
  }

  private writeAt(fd: number, buf: Buffer, position: number): Promise<void> {
    return new Promise((resolve, reject) => {
      fs.write(fd, buf, 0, buf.length, position, (err) => (err ? reject(err) : resolve()));
    });
  }

  private readAt(fd: number, length: number, position: number): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const out = Buffer.allocUnsafe(length);
      fs.read(fd, out, 0, length, position, (err, bytesRead) => {
        if (err) reject(err);
        else resolve(bytesRead === length ? out : out.subarray(0, bytesRead));
      });
    });
  }

  /** Fetch the full event by id, or null if it was never stored / has been evicted. */
  async get(id: string): Promise<ParsedNetworkEvent | null> {
    if (this.disposed) return null;
    const buffered = this.pending.get(id);
    if (buffered) return this.parse(buffered);
    const entry = this.index.get(id);
    if (!entry || this.fd == null) return null;
    try {
      const buf = await this.readAt(this.fd, entry.length, entry.offset);
      return this.parse(buf);
    } catch {
      return null;
    }
  }

  private parse(buf: Buffer): ParsedNetworkEvent | null {
    try {
      return JSON.parse(buf.toString('utf8')) as ParsedNetworkEvent;
    } catch {
      return null;
    }
  }

  /** Forget an id (its bytes remain as dead space until the file is disposed). */
  remove(id: string): void {
    this.index.delete(id);
    this.pending.delete(id);
  }

  /** Drop all records but keep the file open for continued capture. */
  clear(): void {
    this.index.clear();
    this.pending.clear();
    this.queue.length = 0;
    if (this.fd != null) {
      try {
        fs.ftruncateSync(this.fd, 0);
      } catch {
        /* ignore */
      }
    }
    this.writeOffset = 0;
    this.capped = false;
  }

  /** Close the file descriptor and delete the temp file. Safe to call repeatedly. */
  dispose(): void {
    this.disposed = true;
    this.queue.length = 0;
    this.pending.clear();
    this.index.clear();
    if (this.fd != null) {
      try {
        fs.closeSync(this.fd);
      } catch {
        /* ignore */
      }
      this.fd = null;
    }
    if (this.filePath) {
      try {
        fs.unlinkSync(this.filePath);
      } catch {
        /* ignore */
      }
      this.filePath = null;
    }
  }
}
