/**
 * Tiny little-endian buffer reader/writer — the in-house replacement for the
 * `smart-buffer` dependency roku-debug used. Only the operations the BrightScript
 * debug protocol needs (LE ints, 64-bit big-ints, float/double, NUL-terminated
 * UTF-8 strings). All multi-byte reads/writes are little-endian.
 */

/** Sequential little-endian reader over a Buffer, tracking a read offset. */
export class BufReader {
  offset = 0;
  constructor(private readonly buf: Buffer, offset = 0) {
    this.offset = offset;
  }

  get length(): number {
    return this.buf.length;
  }

  get remaining(): number {
    return this.buf.length - this.offset;
  }

  u8(): number {
    const v = this.buf.readUInt8(this.offset);
    this.offset += 1;
    return v;
  }

  u32(): number {
    const v = this.buf.readUInt32LE(this.offset);
    this.offset += 4;
    return v;
  }

  i32(): number {
    const v = this.buf.readInt32LE(this.offset);
    this.offset += 4;
    return v;
  }

  u64(): bigint {
    const v = this.buf.readBigUInt64LE(this.offset);
    this.offset += 8;
    return v;
  }

  i64(): bigint {
    const v = this.buf.readBigInt64LE(this.offset);
    this.offset += 8;
    return v;
  }

  f32(): number {
    const v = this.buf.readFloatLE(this.offset);
    this.offset += 4;
    return v;
  }

  f64(): number {
    const v = this.buf.readDoubleLE(this.offset);
    this.offset += 8;
    return v;
  }

  /**
   * Read a NUL-terminated UTF-8 string starting at the current offset. Throws if
   * no terminator exists in the remaining bytes (the caller treats that as "need
   * more data" and waits for the next TCP chunk).
   */
  stringNT(): string {
    let end = -1;
    for (let i = this.offset; i < this.buf.length; i++) {
      if (this.buf[i] === 0x00) {
        end = i;
        break;
      }
    }
    if (end < 0) {
      throw new Error('No NUL terminator for string');
    }
    const s = this.buf.toString('utf8', this.offset, end);
    this.offset = end + 1;
    return s;
  }
}

/** Sequential little-endian writer accumulating chunks; concat once at the end. */
export class BufWriter {
  private chunks: Buffer[] = [];

  get length(): number {
    let n = 0;
    for (const c of this.chunks) n += c.length;
    return n;
  }

  u8(v: number): this {
    const b = Buffer.allocUnsafe(1);
    b.writeUInt8(v & 0xff, 0);
    this.chunks.push(b);
    return this;
  }

  u32(v: number): this {
    const b = Buffer.allocUnsafe(4);
    b.writeUInt32LE(v >>> 0, 0);
    this.chunks.push(b);
    return this;
  }

  i32(v: number): this {
    const b = Buffer.allocUnsafe(4);
    b.writeInt32LE(v | 0, 0);
    this.chunks.push(b);
    return this;
  }

  i64(v: bigint): this {
    const b = Buffer.allocUnsafe(8);
    b.writeBigInt64LE(v, 0);
    this.chunks.push(b);
    return this;
  }

  f32(v: number): this {
    const b = Buffer.allocUnsafe(4);
    b.writeFloatLE(v, 0);
    this.chunks.push(b);
    return this;
  }

  f64(v: number): this {
    const b = Buffer.allocUnsafe(8);
    b.writeDoubleLE(v, 0);
    this.chunks.push(b);
    return this;
  }

  /** Write a UTF-8 string followed by a NUL terminator. */
  stringNT(s: string): this {
    this.chunks.push(Buffer.from(String(s ?? ''), 'utf8'));
    this.chunks.push(Buffer.from([0x00]));
    return this;
  }

  raw(buf: Buffer): this {
    this.chunks.push(buf);
    return this;
  }

  toBuffer(): Buffer {
    return Buffer.concat(this.chunks);
  }
}
