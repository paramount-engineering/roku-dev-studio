/**
 * Minimal `multipart/form-data` body parser — the server-side counterpart to
 * `buildMultipartBody` in `http-digest.ts`. Used by the Sideload Relay's "fake
 * Roku" HTTP server to pull the `mysubmit` field and the uploaded `archive`
 * (.zip) out of a `POST /plugin_install` body, exactly as a Roku device would.
 *
 * Kept intentionally small: it handles the shapes real clients (roku-deploy,
 * VS Code roku-debug, Eclipse) send — fields and a single binary file part —
 * and does not attempt full RFC 7578 coverage (nested multipart, transfer
 * encodings, etc.), which Roku's own endpoint never receives.
 */

'use strict';

interface MultipartField {
  name: string;
  value: string;
}
interface MultipartFile {
  name: string;
  filename: string;
  contentType: string;
  data: Buffer;
}
interface ParsedMultipart {
  fields: MultipartField[];
  files: MultipartFile[];
}

/** Extract the boundary token from a `Content-Type: multipart/form-data; boundary=...` header. */
function extractBoundary(contentType: string | undefined): string | null {
  if (!contentType) return null;
  const m = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType);
  if (!m) return null;
  return (m[1] ?? m[2] ?? '').trim() || null;
}

function parseHeaders(headerBlock: string): {
  name: string | null;
  filename: string | null;
  contentType: string | null;
} {
  let name: string | null = null;
  let filename: string | null = null;
  let contentType: string | null = null;
  for (const line of headerBlock.split('\r\n')) {
    if (!line) continue;
    const cd = /^content-disposition:\s*(.*)$/i.exec(line);
    if (cd) {
      const nameM = /\bname="([^"]*)"/i.exec(cd[1]!);
      if (nameM) name = nameM[1] ?? null;
      const fileM = /\bfilename="([^"]*)"/i.exec(cd[1]!);
      if (fileM) filename = fileM[1] ?? null;
      continue;
    }
    const ct = /^content-type:\s*(.*)$/i.exec(line);
    if (ct) contentType = (ct[1] ?? '').trim();
  }
  return { name, filename, contentType };
}

/**
 * Parse a multipart/form-data body. Returns `null` when the content-type has
 * no usable boundary or the body doesn't contain any recognizable parts.
 */
function parseMultipart(body: Buffer, contentType: string | undefined): ParsedMultipart | null {
  const boundary = extractBoundary(contentType);
  if (!boundary) return null;

  const delimiter = Buffer.from(`--${boundary}`);
  const crlf = Buffer.from('\r\n');
  const fields: MultipartField[] = [];
  const files: MultipartFile[] = [];

  let pos = body.indexOf(delimiter, 0);
  if (pos < 0) return null;

  while (pos >= 0) {
    let cursor = pos + delimiter.length;
    // End marker: `--boundary--`
    if (body[cursor] === 0x2d && body[cursor + 1] === 0x2d) break;
    // Skip the CRLF after the boundary line.
    if (body[cursor] === 0x0d && body[cursor + 1] === 0x0a) cursor += 2;

    const headerEnd = body.indexOf(Buffer.from('\r\n\r\n'), cursor);
    if (headerEnd < 0) break;
    const headerBlock = body.slice(cursor, headerEnd).toString('utf8');
    const contentStart = headerEnd + 4;

    // The next part begins at the following `\r\n--boundary`.
    const nextBoundary = body.indexOf(Buffer.concat([crlf, delimiter]), contentStart);
    if (nextBoundary < 0) break;

    const partData = body.slice(contentStart, nextBoundary);
    const { name, filename, contentType: partCt } = parseHeaders(headerBlock);

    if (filename != null) {
      files.push({
        name: name || 'file',
        filename,
        contentType: partCt || 'application/octet-stream',
        data: partData
      });
    } else if (name != null) {
      fields.push({ name, value: partData.toString('utf8') });
    }

    pos = nextBoundary + crlf.length;
  }

  if (fields.length === 0 && files.length === 0) return null;
  return { fields, files };
}

/** Convenience: look up a single field value by name (case-sensitive, first match). */
function getField(parsed: ParsedMultipart, name: string): string | undefined {
  return parsed.fields.find((f) => f.name === name)?.value;
}

/** Convenience: the first uploaded file part (Roku sends exactly one `archive`). */
function getFirstFile(parsed: ParsedMultipart): MultipartFile | undefined {
  return parsed.files[0];
}

module.exports = { parseMultipart, getField, getFirstFile };
