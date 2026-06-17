/** Incremental pcap byte stream — avoids O(n²) Buffer.concat on high-volume capture. */
export class PcapByteStream {
  private chunks: Buffer[] = [];
  private length = 0;

  get size(): number {
    return this.length;
  }

  append(chunk: Buffer): void {
    if (chunk.length === 0) return;
    this.chunks.push(chunk);
    this.length += chunk.length;
  }

  clear(): void {
    this.chunks = [];
    this.length = 0;
  }

  byteAt(index: number): number {
    let offset = 0;
    for (const chunk of this.chunks) {
      if (index < offset + chunk.length) {
        return chunk[index - offset];
      }
      offset += chunk.length;
    }
    return 0;
  }

  readUInt32LE(index: number): number {
    return (
      this.byteAt(index) |
      (this.byteAt(index + 1) << 8) |
      (this.byteAt(index + 2) << 16) |
      (this.byteAt(index + 3) << 24)
    ) >>> 0;
  }

  slice(start: number, end: number): Buffer {
    const out = Buffer.allocUnsafe(end - start);
    let written = 0;
    let offset = 0;
    for (const chunk of this.chunks) {
      const chunkEnd = offset + chunk.length;
      if (chunkEnd <= start) {
        offset = chunkEnd;
        continue;
      }
      if (offset >= end) break;
      const from = Math.max(0, start - offset);
      const to = Math.min(chunk.length, end - offset);
      chunk.copy(out, written, from, to);
      written += to - from;
      offset = chunkEnd;
    }
    return out;
  }

  shift(count: number): void {
    if (count <= 0) return;
    if (count >= this.length) {
      this.clear();
      return;
    }
    let remaining = count;
    while (remaining > 0 && this.chunks.length > 0) {
      const head = this.chunks[0];
      if (head.length <= remaining) {
        remaining -= head.length;
        this.chunks.shift();
      } else {
        this.chunks[0] = head.subarray(remaining);
        remaining = 0;
      }
    }
    this.length -= count;
  }
}
