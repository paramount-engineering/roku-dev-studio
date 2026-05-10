/**
 * Roku Remote Server
 * 
 * This server runs on a remote Mac Mini and provides a REST API to control
 * Roku devices on the local network. It acts as a bridge between the
 * Roku Dev Studio desktop app and Roku devices at a remote location.
 * 
 * Usage:
 *   node roku-remote-server.js [port]
 *   Default port: 4951
 * 
 * API Endpoints:
 *   GET  /health              - Server health check
 *   GET  /capabilities        - Get server capabilities/features
 *   GET  /devices             - Discover all Roku devices
 *   GET  /device/:ip/info     - Get device info
 *   POST /device/:ip/keypress/:key  - Send key press
 *   POST /device/:ip/launch/:appId  - Launch an app
 *   GET  /device/:ip/query/*  - Query endpoint (device-info, apps, etc.)
 *   POST /device/:ip/post/*   - POST endpoint (sgrendezvous, etc.)
 *   POST /device/:ip/input-text     - Send text input
 *   POST /device/:ip/deeplink       - Deep link to content
 *   GET  /device/:ip/icon/:appId    - Get app icon
 *   GET  /device/:ip/hardware-image - Roku hardware image (UPnP icon, proxied)
 *   POST /device/:ip/sideload       - Sideload a channel (multipart)
 *   POST /device/:ip/delete-sideload - Delete sideloaded channel
 *   POST /device/:ip/verify-dev-auth - Check developer password (Digest, port 80)
 *   POST /device/:ip/screenshot     - Take screenshot
 *   POST /device/:ip/rale/wake      - Wake RALE TrackerTask
 *   POST /device/:ip/rale/connect   - Connect to RALE
 *   POST /device/:ip/rale/command   - Send RALE command
 *   POST /device/:ip/rale/disconnect - Disconnect RALE
 */

const http = require('http');
const os = require('os');
const nodeCrypto = require('crypto');
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');
const { resolveUnderBase, isPathUnderOneOf, resolveUserPathUnderOneOf } = require('../../lib/path-safe.js');

const execPromise = promisify(exec);

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
const {
  ssdpDiscover,
  subnetScan,
  getDeviceInfo: fetchDeviceInfoFromPackage,
  getDeviceId,
  fetchDeviceHardwareImage,
  isValidIp,
  ecpRequest,
  keypress,
  inputText,
  launch,
  query,
  post,
  deeplink,
  getIcon,
  captureRokuScreenshot,
  verifyDeveloperDigestAuth,
  sideloadChannel,
  deleteSideload,
  raleWake,
  raleConnect,
  raleCommand,
  raleDisconnect,
  raleDisconnectAll,
  connectRokuDebugTelnet,
  connectRokuSystemTelnet,
  writeRokuTelnetLine,
  DEVICE_METRICS_SAMPLE_INTERVAL_MIN_MS
} = require('roku-dev-studio-api');

/** GET `/query/*` cache TTL — matches Dev Studio minimum Device Performance sampling interval (ms). */
const RELAY_QUERY_CACHE_TTL_MS = DEVICE_METRICS_SAMPLE_INTERVAL_MIN_MS;

type RelayQueryCacheEntry = { at: number; payload: unknown };

/** Coalesces concurrent Dev Studio pollers (chanperf, active-app, object-counts, …) into one ECP hit per TTL. */
const relayQueryCache = new Map<string, RelayQueryCacheEntry>();

function relayQueryCacheKey(ip: string, endpoint: string): string {
  return `${ip}\u0000${endpoint}`;
}

function cloneJson<T>(x: T): T {
  return JSON.parse(JSON.stringify(x)) as T;
}

function pruneExpiredRelayQueryCache(now: number): void {
  if (relayQueryCache.size < 400) return;
  for (const [k, v] of relayQueryCache) {
    if (now - v.at > RELAY_QUERY_CACHE_TTL_MS) relayQueryCache.delete(k);
  }
  if (relayQueryCache.size > 600) relayQueryCache.clear();
}

function tryRelayQueryCache(ip: string, endpoint: string): unknown | null {
  const now = Date.now();
  const key = relayQueryCacheKey(ip, endpoint);
  const hit = relayQueryCache.get(key);
  if (!hit) return null;
  if (now - hit.at > RELAY_QUERY_CACHE_TTL_MS) {
    relayQueryCache.delete(key);
    return null;
  }
  return cloneJson(hit.payload);
}

function storeRelayQueryCache(ip: string, endpoint: string, result: unknown): void {
  const r = result as { success?: boolean } | null;
  if (!r || r.success !== true) return;
  const now = Date.now();
  pruneExpiredRelayQueryCache(now);
  relayQueryCache.set(relayQueryCacheKey(ip, endpoint), {
    at: now,
    payload: cloneJson(result)
  });
}

// Configuration
const PORT = parseInt(process.argv[2]) || 4951;

// Store active Telnet sessions: sessionId -> { socket, wsClients, deviceIP, buffer, lastActivity }
const telnetSessions = new Map();

// Store active Telnet System connections (port 8080): deviceIP -> { socket, buffer, listeners, lastActivity }
const telnetSystemConnections = new Map();

// Cached devices (refreshed on discovery)
let cachedDevices = new Map();

// ============================================
// Utility Functions
// ============================================

/**
 * Return a safe CORS Origin for the request (no wildcard).
 * Allows same-origin, localhost, and 127.0.0.1 to satisfy browsers without using *.
 */
function getAllowedOrigin(req) {
  const origin = req && req.headers && req.headers.origin;
  if (!origin || typeof origin !== 'string') return null;
  try {
    const u = new URL(origin);
    const host = u.hostname.toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1') return origin;
    const requestHost = (req.headers.host || '').split(':')[0].toLowerCase();
    if (host === requestHost) return origin;
    return null;
  } catch {
    return null;
  }
}

function log(message, ...args) {
  const timestamp = new Date().toISOString();
  console.log('[%s] %s', timestamp, message, ...args);
}

function parseJson(str) {
  try {
    return JSON.parse(str);
  } catch (e) {
    return null;
  }
}

// Parse form-urlencoded data
function parseFormUrlEncoded(str) {
  const params = {};
  const pairs = str.split('&');
  for (const pair of pairs) {
    const [key, value] = pair.split('=');
    if (key) {
      params[decodeURIComponent(key)] = value ? decodeURIComponent(value.replace(/\+/g, ' ')) : '';
    }
  }
  return params;
}

// Parse body based on content type
function parseBody(body, contentType) {
  if (!body || !body.trim()) return null;
  
  if (contentType && contentType.includes('application/x-www-form-urlencoded')) {
    return parseFormUrlEncoded(body);
  }
  
  // Try JSON first, then form-urlencoded as fallback
  const jsonResult = parseJson(body);
  if (jsonResult) return jsonResult;
  
  return parseFormUrlEncoded(body);
}

function sendJson(res, data, statusCode = 200) {
  const corsOrigin = (res && res._corsOrigin) || null;
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };
  if (corsOrigin) headers['Access-Control-Allow-Origin'] = corsOrigin;
  res.writeHead(statusCode, headers);
  res.end(JSON.stringify(data));
}

function sendError(res, message, statusCode = 500) {
  sendJson(res, { success: false, error: message }, statusCode);
}

// Max body size for non-upload JSON/form bodies. Prevents a rogue client from
// growing the relay's memory without bound via a single request.
const MAX_TEXT_BODY_BYTES = 1 * 1024 * 1024; // 1 MB
// Max body size for sideload uploads (.pkg / .zip). Covers typical Roku packages.
const MAX_UPLOAD_BODY_BYTES = 256 * 1024 * 1024; // 256 MB

// Read request body
function readBody(req, maxBytes: number = MAX_TEXT_BODY_BYTES) {
  return new Promise((resolve, reject) => {
    let body = '';
    let size = 0;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new Error(`Request body exceeds ${maxBytes} bytes`));
        req.destroy();
        return;
      }
      body += chunk;
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

// Read request body as buffer (for binary data)
function readBodyBuffer(req, maxBytes: number = MAX_UPLOAD_BODY_BYTES): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new Error(`Request body exceeds ${maxBytes} bytes`));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

// Parse multipart form data - robust implementation
function parseMultipart(buffer, boundary) {
  const parts = {};
  
  // Clean boundary (remove quotes if present)
  boundary = boundary.replace(/^["']|["']$/g, '').trim();
  
  const boundaryStr = `--${boundary}`;
  const bufferStr = buffer.toString('binary');
  
  // Split by boundary
  const rawParts = bufferStr.split(boundaryStr);
  
  for (let i = 1; i < rawParts.length; i++) {
    const part = rawParts[i];
    
    // Skip the closing boundary marker
    if (part.trim() === '--' || part.startsWith('--')) continue;
    
    // Find the double CRLF that separates headers from body
    const headerEndIndex = part.indexOf('\r\n\r\n');
    if (headerEndIndex === -1) continue;
    
    const headerSection = part.substring(0, headerEndIndex);
    let bodySection = part.substring(headerEndIndex + 4);
    
    // Remove trailing \r\n
    if (bodySection.endsWith('\r\n')) {
      bodySection = bodySection.slice(0, -2);
    }
    
    // Parse Content-Disposition header
    const nameMatch = headerSection.match(/name="([^"]+)"/i);
    const filenameMatch = headerSection.match(/filename="([^"]+)"/i);
    
    if (nameMatch) {
      const fieldName = nameMatch[1];
      
      if (filenameMatch) {
        // This is a file field - convert back to buffer
        const fileBuffer = Buffer.from(bodySection, 'binary');
        const contentTypeMatch = headerSection.match(/Content-Type:\s*([^\r\n]+)/i);
        
        parts[fieldName] = {
          filename: filenameMatch[1],
          data: fileBuffer,
          contentType: contentTypeMatch ? contentTypeMatch[1].trim() : 'application/octet-stream'
        };
        
        log(`Parsed file field '${fieldName}': ${filenameMatch[1]} (${fileBuffer.length} bytes)`);
      } else {
        // This is a regular field
        parts[fieldName] = bodySection.trim();
        log(`Parsed field '${fieldName}': ${bodySection.trim()}`);
      }
    }
  }
  
  return parts;
}

// Create temp directory for uploads (path under tmp only)
const TEMP_DIR = resolveUnderBase(os.tmpdir(), 'roku-relay-uploads') || path.join(os.tmpdir(), 'roku-relay-uploads');
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// ============================================
// Roku Device Discovery + ECP (roku-dev-studio-api)
// ============================================

// Get device info from a Roku (sameSubnet omitted on relay host)
async function getDeviceInfo(ip) {
  return fetchDeviceInfoFromPackage(ip, { includeSameSubnet: false });
}

// Combined discovery
async function discoverDevices() {
  log('Starting device discovery...');

  let devices;
  try {
    devices = await ssdpDiscover({
      log: (msg) => log(msg),
      timeout: 6000,
      earlyFinishMs: 2500
    });
  } catch (err) {
    log('SSDP discovery error:', errMsg(err));
    devices = [];
  }

  if (devices.length === 0) {
    log('SSDP found no devices, trying subnet scan...');
    try {
      devices = await subnetScan({
        log: (msg) => log(msg),
        requestTimeout: 500,
        concurrency: 50
      });
    } catch (err) {
      log('Subnet scan error:', errMsg(err));
    }
  }

  cachedDevices.clear();
  devices.forEach(d => {
    if (!d || !d.ip) {
      log('Warning: Skipping invalid device in cache:', d);
      return;
    }
    const deviceId = getDeviceId(d) || d.ip;
    cachedDevices.set(deviceId, d);
    log(`Cached device: ${d.deviceName || 'Unknown'} (${d.ip}), ID: ${deviceId}`);
  });

  log(`Discovery complete. Found ${devices.length} device(s)`);
  return devices;
}

// ============================================
// Telnet Debug Console (Port 8085) — TCP via roku-dev-studio-api
// ============================================

/**
 * Connect to Roku telnet debug console
 * @param {string} deviceIP - Roku device IP
 * @returns {Promise<{success: boolean, sessionId?: string, error?: string}>}
 */
async function telnetConnect(deviceIP) {
  for (const [existingId, session] of telnetSessions.entries()) {
    if (session.deviceIP === deviceIP && session.socket && !session.socket.destroyed) {
      log(`Telnet: Reusing existing session ${existingId} for ${deviceIP}`);
      return { success: true, sessionId: existingId, reused: true };
    }
  }

  const sessionId = nodeCrypto.randomUUID();
  log(`Telnet: Creating new session ${sessionId} for ${deviceIP}`);

  const conn = await connectRokuDebugTelnet(deviceIP);
  if (!conn.success) {
    return { success: false, error: conn.error };
  }

  const socket = conn.socket;
  log(`Telnet: Connected to ${deviceIP}:8085`);

  const session = {
    socket,
    wsClients: new Set(),
    deviceIP,
    buffer: '',
    lineBuffer: '',
    lastActivity: Date.now()
  };

  telnetSessions.set(sessionId, session);

  socket.on('data', (data) => {
    const text = data.toString();
    const s = telnetSessions.get(sessionId);

    if (s) {
      s.lastActivity = Date.now();
      s.lineBuffer = (s.lineBuffer || '') + text;
      const lines = s.lineBuffer.split(/\r?\n/);
      s.lineBuffer = lines.pop() || '';

      if (lines.length > 0) {
        const completeText = lines.join('\n') + '\n';
        if (s.wsClients.size > 0) {
          const message = JSON.stringify({ type: 'log', data: completeText });
          s.wsClients.forEach((ws) => {
            if (ws.readyState === 1) {
              ws.send(message);
            }
          });
        } else {
          s.buffer = (s.buffer || '') + completeText;
          if (s.buffer.length > 100000) {
            s.buffer = s.buffer.slice(-50000);
          }
        }
      }
    }
  });

  socket.on('error', (error) => {
    log(`Telnet: Socket error for ${deviceIP}: ${errMsg(error)}`);
    telnetSessionClose(sessionId);
  });

  socket.on('close', (hadError) => {
    log(`Telnet: Socket closed for ${deviceIP}, hadError: ${hadError}`);
    const s = telnetSessions.get(sessionId);
    if (s) {
      if (s.lineBuffer && s.lineBuffer.length > 0) {
        const message = JSON.stringify({ type: 'log', data: s.lineBuffer });
        s.wsClients.forEach((ws) => {
          if (ws.readyState === 1) {
            ws.send(message);
          }
        });
      }
      const disconnectMsg = JSON.stringify({ type: 'disconnected', hadError });
      s.wsClients.forEach((ws) => {
        if (ws.readyState === 1) {
          ws.send(disconnectMsg);
          ws.close();
        }
      });
      telnetSessions.delete(sessionId);
    }
  });

  return { success: true, sessionId };
}

/**
 * Close a telnet session
 */
function telnetSessionClose(sessionId) {
  const session = telnetSessions.get(sessionId);
  if (session) {
    log(`Telnet: Closing session ${sessionId}`);
    if (session.socket && !session.socket.destroyed) {
      session.socket.destroy();
    }
    session.wsClients.forEach(ws => {
      if (ws.readyState === 1) {
        ws.send(JSON.stringify({ type: 'disconnected' }));
        ws.close();
      }
    });
    telnetSessions.delete(sessionId);
  }
}

/**
 * Get telnet session status
 */
function telnetStatus(sessionId) {
  const session = telnetSessions.get(sessionId);
  if (!session) {
    return { connected: false };
  }
  return {
    connected: session.socket && !session.socket.destroyed,
    deviceIP: session.deviceIP,
    clients: session.wsClients.size,
    lastActivity: session.lastActivity
  };
}

/**
 * Handle WebSocket upgrade for telnet streaming
 */
function handleTelnetWebSocket(req, socket, head, sessionId) {
  const session = telnetSessions.get(sessionId);
  
  if (!session) {
    socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
    socket.destroy();
    return;
  }

  // Perform WebSocket handshake (RFC 6455). Sec-WebSocket-Accept is a hash of the
  // client key—not user-controlled HTML; safe to send in response header.
  const key = req.headers['sec-websocket-key'];
  const acceptKey = nodeCrypto
    .createHash('sha1')
    .update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
    .digest('base64');

  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
    'Upgrade: websocket\r\n' +
    'Connection: Upgrade\r\n' +
    `Sec-WebSocket-Accept: ${acceptKey}\r\n` +
    '\r\n'
  );

  log(`Telnet: WebSocket client connected to session ${sessionId}`);
  
  // Create a simple WebSocket wrapper
  const ws = {
    readyState: 1, // OPEN
    send: (data) => {
      if (ws.readyState !== 1) return;
      const buffer = Buffer.from(data);
      const frame = createWebSocketFrame(buffer);
      socket.write(frame);
    },
    close: () => {
      ws.readyState = 3; // CLOSED
      socket.end();
    }
  };

  session.wsClients.add(ws);
  session.lastActivity = Date.now();

  // Send buffered logs
  if (session.buffer && session.buffer.length > 0) {
    ws.send(JSON.stringify({ type: 'log', data: session.buffer }));
    session.buffer = '';
  }

  // Handle incoming WebSocket frames
  let frameBuffer = Buffer.alloc(0);
  
  socket.on('data', (data) => {
    frameBuffer = Buffer.concat([frameBuffer, data]);
    
    while (frameBuffer.length >= 2) {
      const frame = parseWebSocketFrame(frameBuffer);
      if (!frame) break;
      
      frameBuffer = frameBuffer.slice(frame.totalLength);
      
      if (frame.opcode === 0x8) {
        // Close frame
        ws.readyState = 3;
        session.wsClients.delete(ws);
        socket.end();
        return;
      }
      
      if (frame.opcode === 0x1 && frame.payload) {
        // Text frame - could handle commands here if needed
        session.lastActivity = Date.now();
      }
    }
  });

  socket.on('close', () => {
    ws.readyState = 3;
    session.wsClients.delete(ws);
    log(`Telnet: WebSocket client disconnected from session ${sessionId}`);
  });

  socket.on('error', (err) => {
    log(`Telnet: WebSocket error: ${errMsg(err)}`);
    ws.readyState = 3;
    session.wsClients.delete(ws);
  });
}

/**
 * Create a WebSocket frame for sending data
 */
function createWebSocketFrame(data) {
  const length = data.length;
  let header;

  if (length < 126) {
    header = Buffer.alloc(2);
    header[0] = 0x81; // FIN + text frame
    header[1] = length;
  } else if (length < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(length), 2);
  }

  return Buffer.concat([header, data]);
}

/**
 * Parse an incoming WebSocket frame
 */
function parseWebSocketFrame(buffer) {
  if (buffer.length < 2) return null;

  const firstByte = buffer[0];
  const secondByte = buffer[1];
  const opcode = firstByte & 0x0f;
  const isMasked = (secondByte & 0x80) !== 0;
  let payloadLength = secondByte & 0x7f;
  let offset = 2;

  if (payloadLength === 126) {
    if (buffer.length < 4) return null;
    payloadLength = buffer.readUInt16BE(2);
    offset = 4;
  } else if (payloadLength === 127) {
    if (buffer.length < 10) return null;
    payloadLength = Number(buffer.readBigUInt64BE(2));
    offset = 10;
  }

  const maskOffset = offset;
  if (isMasked) offset += 4;

  const totalLength = offset + payloadLength;
  if (buffer.length < totalLength) return null;

  let payload = buffer.slice(offset, totalLength);
  
  if (isMasked) {
    const mask = buffer.slice(maskOffset, maskOffset + 4);
    for (let i = 0; i < payload.length; i++) {
      payload[i] ^= mask[i % 4];
    }
  }

  return { opcode, payload: payload.toString(), totalLength };
}

// Cleanup stale telnet sessions every 5 minutes
setInterval(() => {
  const now = Date.now();
  const TIMEOUT = 30 * 60 * 1000; // 30 minutes
  
  for (const [sessionId, session] of telnetSessions.entries()) {
    if (now - session.lastActivity > TIMEOUT) {
      log(`Telnet: Cleaning up stale session ${sessionId}`);
      telnetSessionClose(sessionId);
    }
  }
  
  // Cleanup stale telnet system connections
  for (const [deviceIP, conn] of telnetSystemConnections.entries()) {
    if (now - conn.lastActivity > TIMEOUT) {
      log(`Telnet System: Cleaning up stale connection for ${deviceIP}`);
      if (conn.socket && !conn.socket.destroyed) {
        conn.socket.destroy();
      }
      telnetSystemConnections.delete(deviceIP);
    }
  }
}, 5 * 60 * 1000);

// ============================================
// Telnet System Commands (Port 8080)
// ============================================

/**
 * Connect to Roku telnet system console (port 8080)
 * @param {string} deviceIP - Roku device IP
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function telnetSystemConnect(deviceIP) {
  if (telnetSystemConnections.has(deviceIP)) {
    log(`Telnet System: Closing existing connection for ${deviceIP}`);
    const oldConn = telnetSystemConnections.get(deviceIP);
    if (oldConn.socket && !oldConn.socket.destroyed) {
      oldConn.socket.destroy();
    }
    telnetSystemConnections.delete(deviceIP);
  }

  log(`Telnet System: Connecting to ${deviceIP}:8080`);

  const conn = await connectRokuSystemTelnet(deviceIP);
  if (!conn.success) {
    return { success: false, error: conn.error };
  }

  const socket = conn.socket;
  log(`Telnet System: Connected to ${deviceIP}:8080`);

  const connection = {
    socket,
    buffer: '',
    listeners: new Set(),
    lastActivity: Date.now()
  };

  telnetSystemConnections.set(deviceIP, connection);

  socket.on('data', (data) => {
    const text = data.toString();
    const c = telnetSystemConnections.get(deviceIP);
    if (c) {
      c.lastActivity = Date.now();
      c.buffer += text;
      c.listeners.forEach((listener) => {
        try {
          listener({ ip: deviceIP, data: text });
        } catch (e) {
          log(`Telnet System: Error in listener: ${errMsg(e)}`);
        }
      });
    }
  });

  socket.on('error', (error) => {
    log(`Telnet System: Socket error for ${deviceIP}: ${errMsg(error)}`);
    telnetSystemDisconnect(deviceIP);
  });

  socket.on('close', (hadError) => {
    log(`Telnet System: Socket closed for ${deviceIP}, hadError: ${hadError}`);
    telnetSystemConnections.delete(deviceIP);
  });

  return { success: true };
}

/**
 * Disconnect from Roku telnet system console
 * @param {string} deviceIP - Roku device IP
 * @returns {Promise<{success: boolean}>}
 */
function telnetSystemDisconnect(deviceIP) {
  const connection = telnetSystemConnections.get(deviceIP);
  if (connection) {
    log(`Telnet System: Disconnecting from ${deviceIP}`);
    if (connection.socket && !connection.socket.destroyed) {
      connection.socket.destroy();
    }
    telnetSystemConnections.delete(deviceIP);
  }
  return Promise.resolve({ success: true });
}

/**
 * Send command to telnet system console
 * @param {string} deviceIP - Roku device IP
 * @param {string} command - Command to send
 * @returns {Promise<{success: boolean, error?: string}>}
 */
function telnetSystemSend(deviceIP, command) {
  const connection = telnetSystemConnections.get(deviceIP);
  
  if (!connection || !connection.socket || connection.socket.destroyed) {
    return Promise.resolve({ success: false, error: 'Not connected' });
  }

  log(`Telnet System: Sending command '${command}' to ${deviceIP}`);

  const w = writeRokuTelnetLine(connection.socket, command, { lineEnding: '\n' });
  if (w.success) {
    connection.lastActivity = Date.now();
  } else {
    log(`Telnet System: Error sending command: ${w.error}`);
  }
  return Promise.resolve(w);
}

/**
 * Get telnet system connection status
 * @param {string} deviceIP - Roku device IP
 * @returns {Promise<{connected: boolean}>}
 */
function telnetSystemStatus(deviceIP) {
  const connection = telnetSystemConnections.get(deviceIP);
  if (!connection) {
    return Promise.resolve({ connected: false });
  }
  return Promise.resolve({
    connected: connection.socket && !connection.socket.destroyed,
    lastActivity: connection.lastActivity
  });
}

/**
 * Register a listener for telnet system data
 * Note: This is a simplified approach - in a real implementation, you might want
 * to use WebSockets or Server-Sent Events for real-time streaming.
 * For now, we'll use polling via status endpoint or return buffered data.
 * @param {string} deviceIP - Roku device IP
 * @param {Function} listener - Callback function(data)
 * @returns {Function} Cleanup function
 */
function telnetSystemAddListener(deviceIP, listener) {
  const connection = telnetSystemConnections.get(deviceIP);
  if (connection) {
    connection.listeners.add(listener);
    return () => {
      connection.listeners.delete(listener);
    };
  }
  return () => {};
}

// ============================================
// HTTP Server Request Handler
// ============================================

async function handleRequest(req, res) {
  res._corsOrigin = getAllowedOrigin(req);

  // Use WHATWG URL API instead of deprecated url.parse()
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  // CORS preflight
  if (method === 'OPTIONS') {
    const corsHeaders = {
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    };
    if (res._corsOrigin) corsHeaders['Access-Control-Allow-Origin'] = res._corsOrigin;
    res.writeHead(204, corsHeaders);
    res.end();
    return;
  }

  log(`${method} ${pathname}`);

  try {
    // Swagger UI
    if ((pathname === '/api-docs' || pathname === '/api-docs/') && method === 'GET') {
      const swaggerHtmlPath = resolveUnderBase(__dirname, 'swagger-ui.html') || path.join(__dirname, 'swagger-ui.html');
      try {
        const html = fs.readFileSync(swaggerHtmlPath, 'utf8');
        const swaggerHeaders = { 'Content-Type': 'text/html' };
        if (res._corsOrigin) swaggerHeaders['Access-Control-Allow-Origin'] = res._corsOrigin;
        res.writeHead(200, swaggerHeaders);
        res.end(html);
        return;
      } catch (e) {
        return sendError(res, 'Swagger UI not found', 404);
      }
    }

    // Swagger JSON spec - dynamically set server URL based on request host
    if (pathname === '/api-docs/swagger.json' && method === 'GET') {
      const swaggerJsonPath = resolveUnderBase(__dirname, 'swagger.json') || path.join(__dirname, 'swagger.json');
      try {
        let spec = fs.readFileSync(swaggerJsonPath, 'utf8');
        
        // Replace localhost URL with the actual host from the request
        const host = req.headers.host || `localhost:${PORT}`;
        const protocol = req.headers['x-forwarded-proto'] || 'http';
        const serverUrl = `${protocol}://${host}`;
        
        // Parse and update the server URL dynamically
        const specObj = JSON.parse(spec);
        if (specObj.servers && specObj.servers.length > 0) {
          specObj.servers[0].url = serverUrl;
        }
        
        const specHeaders = { 'Content-Type': 'application/json' };
        if (res._corsOrigin) specHeaders['Access-Control-Allow-Origin'] = res._corsOrigin;
        res.writeHead(200, specHeaders);
        res.end(JSON.stringify(specObj));
        return;
      } catch (e) {
        return sendError(res, 'Swagger spec not found', 404);
      }
    }

    // Health check
    if (pathname === '/health' && method === 'GET') {
      return sendJson(res, { 
        success: true, 
        status: 'ok',
        hostname: os.hostname(),
        platform: os.platform(),
        uptime: process.uptime(),
        deviceCount: cachedDevices.size,
        telnetSessions: telnetSessions.size
      });
    }

    // Server capabilities - advertise what features this server supports
    if (pathname === '/capabilities' && method === 'GET') {
      return sendJson(res, {
        success: true,
        version: '1.0.0',
        capabilities: {
          // Core features
          remote: true,           // Remote control (keypress, text input)
          apps: true,             // App listing and launching
          query: true,            // Device queries (info, apps, etc.)
          
          // Development features
          devApp: true,           // Dev app sideloading
          screenshot: true,       // Screenshot capture
          verifyDevAuth: true,    // Digest auth check (port 80)
          
          // Debug features
          console: true,          // Telnet debug console (port 8085)
          
          // Advanced features
          appConnector: true,     // RALE App Connector / Inspector
          deepLink: true,         // Deep linking support
        },
        serverInfo: {
          hostname: os.hostname(),
          platform: os.platform(),
          nodeVersion: process.version
        }
      });
    }

    // ============================================
    // Telnet Debug Console Endpoints
    // ============================================
    
    // Connect to telnet - new path with device IP
    const telnetConnectMatch = pathname.match(/^\/device\/([^\/]+)\/telnet\/connect$/);
    if (telnetConnectMatch && method === 'POST') {
      const deviceIP = telnetConnectMatch[1];
      // Prevent SSRF: telnet* functions eventually call net.Socket.connect, which would
      // DNS-resolve arbitrary hostnames. Match the same guard the /device/:ip/* ECP routes use.
      if (!isValidIp(deviceIP)) {
        return sendError(res, 'Invalid device IP', 400);
      }
      const result = await telnetConnect(deviceIP);
      return sendJson(res, result);
    }
    
    // Connect to telnet — JSON body (deviceIP)
    if (pathname === '/telnet/connect' && method === 'POST') {
      const body = await readBody(req);
      const params = parseBody(body, req.headers['content-type']);
      
      if (!params || !params.deviceIP) {
        return sendError(res, 'Missing deviceIP parameter', 400);
      }
      if (!isValidIp(params.deviceIP)) {
        return sendError(res, 'Invalid device IP', 400);
      }
      
      const result = await telnetConnect(params.deviceIP);
      return sendJson(res, result);
    }
    
    // Disconnect telnet - new path with device IP
    const telnetDisconnectMatch = pathname.match(/^\/device\/([^\/]+)\/telnet\/disconnect$/);
    if (telnetDisconnectMatch && method === 'POST') {
      const deviceIP = telnetDisconnectMatch[1];
      if (!isValidIp(deviceIP)) {
        return sendError(res, 'Invalid device IP', 400);
      }
      // Find session by device IP and close it
      for (const [sessionId, session] of telnetSessions.entries()) {
        if (session.deviceIP === deviceIP) {
          telnetSessionClose(sessionId);
          return sendJson(res, { success: true });
        }
      }
      return sendJson(res, { success: true, message: 'No active session for this device' });
    }
    
    // Disconnect telnet — JSON body (sessionId)
    if (pathname === '/telnet/disconnect' && method === 'POST') {
      const body = await readBody(req);
      const params = parseBody(body, req.headers['content-type']);
      
      if (!params || !params.sessionId) {
        return sendError(res, 'Missing sessionId parameter', 400);
      }
      
      telnetSessionClose(params.sessionId);
      return sendJson(res, { success: true });
    }
    
    // Get telnet session status
    const telnetStatusMatch = pathname.match(/^\/telnet\/status\/([^\/]+)$/);
    if (telnetStatusMatch && method === 'GET') {
      const sessionId = telnetStatusMatch[1];
      return sendJson(res, telnetStatus(sessionId));
    }
    
    // List all telnet sessions
    if (pathname === '/telnet/sessions' && method === 'GET') {
      const sessions: Array<{
        sessionId: string;
        deviceIP: unknown;
        connected: boolean;
        clients: number;
        lastActivity: unknown;
      }> = [];
      for (const [sessionId, session] of telnetSessions.entries()) {
        sessions.push({
          sessionId,
          deviceIP: session.deviceIP,
          connected: session.socket && !session.socket.destroyed,
          clients: session.wsClients.size,
          lastActivity: session.lastActivity
        });
      }
      return sendJson(res, { sessions });
    }

    // ============================================
    // Telnet System Commands Endpoints (Port 8080)
    // ============================================
    
    // Connect to telnet system (port 8080)
    const telnetSystemConnectMatch = pathname.match(/^\/device\/([^\/]+)\/telnet-system\/connect$/);
    if (telnetSystemConnectMatch && method === 'POST') {
      const deviceIP = telnetSystemConnectMatch[1];
      if (!isValidIp(deviceIP)) {
        return sendError(res, 'Invalid device IP', 400);
      }
      const result = await telnetSystemConnect(deviceIP);
      return sendJson(res, result);
    }
    
    // Disconnect telnet system
    const telnetSystemDisconnectMatch = pathname.match(/^\/device\/([^\/]+)\/telnet-system\/disconnect$/);
    if (telnetSystemDisconnectMatch && method === 'POST') {
      const deviceIP = telnetSystemDisconnectMatch[1];
      if (!isValidIp(deviceIP)) {
        return sendError(res, 'Invalid device IP', 400);
      }
      const result = await telnetSystemDisconnect(deviceIP);
      return sendJson(res, result);
    }
    
    // Send command to telnet system
    const telnetSystemSendMatch = pathname.match(/^\/device\/([^\/]+)\/telnet-system\/send$/);
    if (telnetSystemSendMatch && method === 'POST') {
      const deviceIP = telnetSystemSendMatch[1];
      if (!isValidIp(deviceIP)) {
        return sendError(res, 'Invalid device IP', 400);
      }
      const body = await readBody(req);
      const params = parseBody(body, req.headers['content-type']);
      
      if (!params || !params.command) {
        return sendError(res, 'Missing command parameter', 400);
      }
      
      const result = await telnetSystemSend(deviceIP, params.command);
      return sendJson(res, result);
    }
    
    // Get telnet system status
    const telnetSystemStatusMatch = pathname.match(/^\/device\/([^\/]+)\/telnet-system\/status$/);
    if (telnetSystemStatusMatch && method === 'GET') {
      const deviceIP = telnetSystemStatusMatch[1];
      if (!isValidIp(deviceIP)) {
        return sendError(res, 'Invalid device IP', 400);
      }
      const result = await telnetSystemStatus(deviceIP);
      return sendJson(res, result);
    }
    
    // Get buffered data from telnet system (for polling-based approach)
    const telnetSystemDataMatch = pathname.match(/^\/device\/([^\/]+)\/telnet-system\/data$/);
    if (telnetSystemDataMatch && method === 'GET') {
      const deviceIP = telnetSystemDataMatch[1];
      const connection = telnetSystemConnections.get(deviceIP);
      
      if (!connection) {
        return sendJson(res, { success: false, error: 'Not connected' });
      }
      
      // Return buffered data and clear buffer
      const data = connection.buffer;
      connection.buffer = '';
      return sendJson(res, { success: true, data });
    }

    // Discover devices
    if (pathname === '/devices' && method === 'GET') {
      const devices = await discoverDevices();
      return sendJson(res, { success: true, devices });
    }

    // Get cached devices (fast)
    if (pathname === '/devices/cached' && method === 'GET') {
      return sendJson(res, { success: true, devices: Array.from(cachedDevices.values()) });
    }

    // Device-specific endpoints
    const deviceMatch = pathname.match(/^\/device\/([^\/]+)(.*)$/);
    if (deviceMatch) {
      const ip = deviceMatch[1];
      const subPath = deviceMatch[2];
      if (!isValidIp(ip)) {
        return sendError(res, 'Invalid device IP', 400);
      }

      // Get device info
      if (subPath === '/info' && method === 'GET') {
        try {
          const deviceInfo = await getDeviceInfo(ip);
          return sendJson(res, { success: true, deviceInfo });
        } catch (error) {
          return sendError(res, errMsg(error));
        }
      }

      // Key press
      const keypressMatch = subPath.match(/^\/keypress\/(.+)$/);
      if (keypressMatch && method === 'POST') {
        const key = decodeURIComponent(keypressMatch[1]);
        const result = await keypress(ip, key);
        return sendJson(res, result);
      }

      // Launch app
      const launchMatch = subPath.match(/^\/launch\/(.+)$/);
      if (launchMatch && method === 'POST') {
        const appId = launchMatch[1];
        const body = await readBody(req);
        const params = parseJson(body);
        // `launch()` in roku-dev-studio-api only appends query params when they are a
        // string. If the client sent `{ params: { contentId: '…' } }` we'd otherwise
        // silently drop them and launch the app with no parameters.
        let launchParams: string | undefined;
        if (params && params.params != null) {
          if (typeof params.params === 'string') {
            launchParams = params.params;
          } else if (typeof params.params === 'object') {
            launchParams = Object.entries(params.params)
              .map(
                ([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`
              )
              .join('&');
          }
        }
        const result = await launch(ip, appId, launchParams);
        return sendJson(res, result);
      }

      // Query endpoints (short-TTL cache — same TTL as minimum Device Performance sample interval)
      if (subPath.startsWith('/query/') && method === 'GET') {
        const endpoint = subPath;
        const cached = tryRelayQueryCache(ip, endpoint);
        if (cached != null) {
          return sendJson(res, cached);
        }
        const result = await query(ip, endpoint);
        storeRelayQueryCache(ip, endpoint, result);
        return sendJson(res, result);
      }

      // POST endpoints (sgrendezvous, fwbeacons, etc.)
      if (subPath.startsWith('/post/') && method === 'POST') {
        const endpoint = subPath.replace('/post', '');
        const result = await post(ip, endpoint);
        return sendJson(res, result);
      }

      // Input text (shared implementation with roku-dev-studio-api — Lit_ keypress sequence)
      if (subPath === '/input-text' && method === 'POST') {
        const body = await readBody(req);
        const params = parseJson(body);
        if (!params || !params.text) {
          return sendError(res, 'Missing text parameter', 400);
        }

        const result = await inputText(ip, params.text, { timeout: 2000, inputKeyDelayMs: 100 });
        return sendJson(res, {
          success: result.success,
          results: result.results,
          ...(result.error && { error: result.error }),
          ...(result.index != null && { index: result.index })
        });
      }

      // Deep link
      if (subPath === '/deeplink' && method === 'POST') {
        const body = await readBody(req);
        const params = parseJson(body);
        if (!params || !params.appId) {
          return sendError(res, 'Missing appId parameter', 400);
        }

        const result = await deeplink(ip, params.appId, params.contentId, params.mediaType);
        return sendJson(res, result);
      }

      // Get app icon
      const iconMatch = subPath.match(/^\/icon\/(.+)$/);
      if (iconMatch && method === 'GET') {
        const appId = decodeURIComponent(iconMatch[1]);
        const result = await getIcon(ip, appId);
        return sendJson(res, result);
      }

      // Roku hardware image (UPnP device-image / iconList)
      if (subPath === '/hardware-image' && method === 'GET') {
        const imgResult = await fetchDeviceHardwareImage(ip);
        if (!imgResult.success) {
          const errStatus =
            typeof imgResult.statusCode === 'number' && imgResult.statusCode >= 400
              ? imgResult.statusCode
              : 502;
          return sendError(res, imgResult.error || 'Image fetch failed', errStatus);
        }
        const binHeaders = {
          'Content-Type': imgResult.contentType || 'image/png',
          'Cache-Control': 'public, max-age=3600',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        };
        if (res._corsOrigin) binHeaders['Access-Control-Allow-Origin'] = res._corsOrigin;
        res.writeHead(200, binHeaders);
        res.end(imgResult.buffer);
        return;
      }

      // Sideload (requires password) - supports both file upload and filePath
      if (subPath === '/sideload' && method === 'POST') {
        const contentType = req.headers['content-type'] || '';
        let filePath = null;
        let password = null;
        let tempFile = null;
        
        // Handle multipart file upload
        if (contentType.includes('multipart/form-data')) {
          const boundaryMatch = contentType.match(/boundary=([^;]+)/);
          if (!boundaryMatch) {
            log(`Sideload: No boundary found in content-type: ${contentType}`);
            return sendError(res, 'Invalid multipart boundary', 400);
          }
          
          const boundary = boundaryMatch[1].trim();
          log(`Sideload: Processing multipart upload with boundary: ${boundary}`);
          
          const buffer = await readBodyBuffer(req);
          log(`Sideload: Received ${buffer.length} bytes`);
          
          const parts = parseMultipart(buffer, boundary) as Record<string, any>;
          log(`Sideload: Parsed fields: ${Object.keys(parts).join(', ')}`);
          
          password = parts.password;
          
          if (parts.file && parts.file.data) {
            // Save uploaded file to temp location (extension only, no path from filename)
            const ext = (path.extname(parts.file.filename) || '.zip').replace(/[^a-zA-Z0-9.]/g, '') || '.zip';
            const safeTempName = `upload-${Date.now()}${ext}`;
            tempFile = resolveUnderBase(TEMP_DIR, safeTempName) || path.join(TEMP_DIR, safeTempName);
            fs.writeFileSync(tempFile, parts.file.data);
            filePath = tempFile;
            log(`Sideload: Saved uploaded file: ${parts.file.filename} -> ${tempFile} (${parts.file.data.length} bytes)`);
          } else {
            log(`Sideload: No file data found. Parts: ${JSON.stringify(Object.keys(parts))}`);
          }
        } else {
          // JSON body: filePath must be under TEMP_DIR
          const body = await readBody(req);
          const params = parseJson(body);
          if (params) {
            if (params.filePath && typeof params.filePath === 'string') {
              const resolvedTempPath = resolveUserPathUnderOneOf([TEMP_DIR], params.filePath);
              if (!resolvedTempPath) {
                return sendError(res, 'Invalid file path', 400);
              }
              filePath = resolvedTempPath;
            }
            password = params.password;
          }
        }
        
        if (!filePath || !password) {
          if (tempFile && fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
          return sendError(res, 'Missing file or password', 400);
        }

        try {
          const result = await sideloadChannel({ ip, filePath, password, log: (msg) => log(msg) });
          if (tempFile && fs.existsSync(tempFile)) {
            fs.unlinkSync(tempFile);
            log(`Cleaned up temp file: ${tempFile}`);
          }
          return sendJson(res, result);
        } catch (error) {
          if (tempFile && fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
          return sendJson(res, { success: false, error: `Upload failed: ${errMsg(error)}` });
        }
      }

      // Delete sideloaded channel (shared logic in lib/roku-plugin-install.js)
      if (subPath === '/delete-sideload' && method === 'POST') {
        const body = await readBody(req);
        const contentType = req.headers['content-type'] || '';
        const params = parseBody(body, contentType);
        if (!params || !params.password) {
          return sendError(res, 'Missing password', 400);
        }
        try {
          const result = await deleteSideload({ ip, password: params.password, log: (msg) => log(msg) });
          return sendJson(res, result);
        } catch (error) {
          return sendJson(res, { success: false, error: `Delete failed: ${errMsg(error)}` });
        }
      }

      // Developer password: Digest GET http://device/ (no screenshot)
      if (subPath === '/verify-dev-auth' && method === 'POST') {
        const body = await readBody(req);
        const contentType = req.headers['content-type'] || '';
        const params = parseBody(body, contentType);
        if (!params || !params.password) {
          return sendError(res, 'Missing password', 400);
        }
        try {
          const result = await verifyDeveloperDigestAuth({ ip, password: params.password });
          return sendJson(res, result);
        } catch (error) {
          return sendJson(res, { success: false, error: `Verify failed: ${errMsg(error)}` });
        }
      }

      // Screenshot (single implementation in lib/roku-screenshot.js; same as Dev App / Action Executor)
      if (subPath === '/screenshot' && method === 'POST') {
        const body = await readBody(req);
        const contentType = req.headers['content-type'] || '';
        const params = parseBody(body, contentType);
        log(`Screenshot request - body: "${body}", contentType: "${contentType}", parsed params:`, params);
        
        if (!params || !params.password) {
          return sendError(res, 'Missing password', 400);
        }

        try {
          let waitAfterTriggerMs: number | undefined;
          if (params.waitAfterTriggerMs != null && params.waitAfterTriggerMs !== '') {
            const parsed = parseInt(String(params.waitAfterTriggerMs), 10);
            if (Number.isFinite(parsed) && parsed >= 0) waitAfterTriggerMs = parsed;
          }
          const result = await captureRokuScreenshot({
            ip,
            password: params.password,
            waitAfterTriggerMs,
            log: (msg) => log(msg)
          });
          if (result.success) {
            return sendJson(res, {
              success: true,
              url: `data:image/jpeg;base64,${result.imageBuffer.toString('base64')}`,
              message: 'Screenshot captured!'
            });
          }
          return sendJson(res, { success: false, error: result.error });
        } catch (error) {
          log(`Screenshot error: ${errMsg(error)}`);
          return sendJson(res, { success: false, error: `Screenshot failed: ${errMsg(error)}` });
        }
      }

      // RALE endpoints
      if (subPath === '/rale/wake' && method === 'POST') {
        const body = await readBody(req);
        const params = parseJson(body);
        const port = params?.port || 49200;
        const result = await raleWake(ip, port);
        return sendJson(res, result);
      }

      if (subPath === '/rale/connect' && method === 'POST') {
        const body = await readBody(req);
        const params = parseJson(body);
        const port = params?.port || 49200;
        log(`RALE: Connecting to ${ip}:${port}...`);
        const result = await raleConnect(ip, port, {
          onClose: (cid) => log(`RALE: Socket closed for ${cid}`)
        });
        if (result.success) {
          log(`RALE: Connected to ${result.connectionId}`);
        }
        return sendJson(res, result);
      }

      if (subPath === '/rale/command' && method === 'POST') {
        const body = await readBody(req);
        const params = parseJson(body);
        if (!params || !params.connectionId || !params.command) {
          return sendError(res, 'Missing connectionId or command', 400);
        }
        log(`RALE: Sending command '${params.command}' to ${params.connectionId}`);
        const result = await raleCommand(params.connectionId, params.command, params.args, {
          timeoutMs: params.timeoutMs
        });
        if (result.success) {
          log(`RALE: Complete response received for command '${params.command}'`);
        }
        return sendJson(res, result);
      }

      if (subPath === '/rale/disconnect' && method === 'POST') {
        const body = await readBody(req);
        const params = parseJson(body);
        if (!params || !params.connectionId) {
          return sendError(res, 'Missing connectionId', 400);
        }
        const result = raleDisconnect(params.connectionId);
        return sendJson(res, result);
      }
    }

    // 404 for unknown routes
    return sendError(res, 'Not Found', 404);

  } catch (error) {
    log('Error handling request:', error);
    return sendError(res, errMsg(error));
  }
}

// ============================================
// Start Server
// ============================================

const server = http.createServer(handleRequest);

// Handle WebSocket upgrade for telnet streaming
server.on('upgrade', (req, socket, head) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;
  
  // Check if this is a telnet stream request: /telnet/stream/{sessionId}
  const match = pathname.match(/^\/telnet\/stream\/([^\/]+)$/);
  if (match) {
    const sessionId = match[1];
    handleTelnetWebSocket(req, socket, head, sessionId);
  } else {
    // Not a telnet WebSocket, reject
    socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
    socket.destroy();
  }
});

server.listen(PORT, '0.0.0.0', () => {
  log(`==============================================`);
  log(`Roku Remote Server started`);
  log(`Port: ${PORT}`);
  log(`Hostname: ${os.hostname()}`);
  log(`==============================================`);
  log(`📚 Swagger API Docs: http://localhost:${PORT}/api-docs`);
  log(`==============================================`);
  log(`API Endpoints:`);
  log(`  GET  /health              - Server health check`);
  log(`  GET  /capabilities        - Get server capabilities`);
  log(`  GET  /api-docs            - Swagger UI documentation`);
  log(`  GET  /devices             - Discover all Roku devices`);
  log(`  GET  /devices/cached      - Get cached devices (fast)`);
  log(`  GET  /device/:ip/info     - Get device info`);
  log(`  POST /device/:ip/keypress/:key - Send key press`);
  log(`  POST /device/:ip/launch/:appId - Launch an app`);
  log(`  GET  /device/:ip/query/*  - Query endpoint`);
  log(`  POST /device/:ip/post/*   - POST endpoint`);
  log(`==============================================`);
  log(`Telnet Debug Console (Port 8085):`);
  log(`  POST /device/:ip/telnet/connect    - Start telnet session`);
  log(`  POST /device/:ip/telnet/disconnect - End telnet session`);
  log(`  GET  /telnet/sessions              - List all sessions`);
  log(`  GET  /telnet/status/:sessionId     - Check session status`);
  log(`  WSS  /telnet/stream/:sessionId     - WebSocket log stream`);
  log(`==============================================`);
  log(`Telnet System Commands (Port 8080):`);
  log(`  POST /device/:ip/telnet-system/connect    - Connect to system console`);
  log(`  POST /device/:ip/telnet-system/disconnect - Disconnect from system console`);
  log(`  POST /device/:ip/telnet-system/send        - Send command`);
  log(`  GET  /device/:ip/telnet-system/status      - Check connection status`);
  log(`  GET  /device/:ip/telnet-system/data       - Get buffered data`);
  log(`==============================================`);
  
  // Initial device discovery
  discoverDevices().then(devices => {
    log(`Initial discovery found ${devices.length} device(s)`);
  });
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  log('Shutting down...');
  raleDisconnectAll();
  // Close telnet sessions
  telnetSessions.forEach((session, id) => {
    telnetSessionClose(id);
  });
  // Close telnet system connections
  telnetSystemConnections.forEach((connection, deviceIP) => {
    if (connection.socket && !connection.socket.destroyed) {
      connection.socket.destroy();
    }
  });
  telnetSystemConnections.clear();
  server.close(() => {
    log('Server stopped');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  log('Received SIGTERM, shutting down...');
  raleDisconnectAll();
  telnetSessions.forEach((_, id) => telnetSessionClose(id));
  telnetSystemConnections.forEach((connection) => {
    if (connection.socket && !connection.socket.destroyed) {
      connection.socket.destroy();
    }
  });
  telnetSystemConnections.clear();
  server.close(() => {
    process.exit(0);
  });
});

