import * as http from 'http';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execSync } from 'child_process';
import { getCommits } from './git';
import { parseCommit } from './categorize';
import { formatMarkdown, formatStats } from './format';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const PORT = parseInt(process.env.PORT || '3000', 10);

// ---------------------------------------------------------------------------
// Rate limiting — simple in-memory token bucket per IP
// ---------------------------------------------------------------------------

interface Bucket {
  tokens: number;
  lastRefill: number;
}

const RATE_LIMIT_CAPACITY = 10;       // max burst
const RATE_LIMIT_REFILL_RATE = 1;     // tokens per second
const buckets = new Map<string, Bucket>();

function allowRequest(ip: string): boolean {
  const now = Date.now();
  let bucket = buckets.get(ip);

  if (!bucket) {
    bucket = { tokens: RATE_LIMIT_CAPACITY - 1, lastRefill: now };
    buckets.set(ip, bucket);
    return true;
  }

  // Refill tokens based on elapsed time
  const elapsed = (now - bucket.lastRefill) / 1000;
  bucket.tokens = Math.min(
    RATE_LIMIT_CAPACITY,
    bucket.tokens + elapsed * RATE_LIMIT_REFILL_RATE
  );
  bucket.lastRefill = now;

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    return true;
  }

  return false;
}

// ---------------------------------------------------------------------------
// URL / path sanitization
// ---------------------------------------------------------------------------

const ALLOWED_PROTOCOLS = ['https:', 'http:'];

export function sanitizeRepoUrl(input: string): string {
  // Reject empty
  if (!input || !input.trim()) {
    throw new Error('repoUrl is required');
  }

  const trimmed = input.trim();

  // Reject local path traversal attempts and file:// URIs
  if (
    trimmed.startsWith('/') ||
    trimmed.startsWith('~') ||
    trimmed.startsWith('.') ||
    trimmed.startsWith('file:')
  ) {
    throw new Error('Local paths and file:// URIs are not allowed');
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error(`Invalid URL: ${trimmed}`);
  }

  if (!ALLOWED_PROTOCOLS.includes(parsed.protocol)) {
    throw new Error(`Protocol not allowed: ${parsed.protocol}`);
  }

  // Reconstruct URL from parsed parts to strip any embedded credentials
  return `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
}

// ---------------------------------------------------------------------------
// Clone a remote repo to a temp dir and return the path
// ---------------------------------------------------------------------------

function cloneRepo(repoUrl: string): string {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'changegen-clone-'));
  try {
    execSync(`git clone --depth=500 ${JSON.stringify(repoUrl)} ${JSON.stringify(tmpDir)}`, {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 60_000,
    });
  } catch (err) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to clone repository: ${msg}`);
  }
  return tmpDir;
}

// ---------------------------------------------------------------------------
// Request helpers
// ---------------------------------------------------------------------------

function getClientIp(req: http.IncomingMessage): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return (Array.isArray(forwarded) ? forwarded[0] : forwarded).split(',')[0].trim();
  }
  return req.socket.remoteAddress || 'unknown';
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function sendJSON(res: http.ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

// ---------------------------------------------------------------------------
// Auth middleware
// ---------------------------------------------------------------------------

function checkAuth(req: http.IncomingMessage): boolean {
  // If no API key is configured, auth is disabled (useful for dev/testing)
  const apiKey = process.env.CHANGEGEN_API_KEY || '';
  if (!apiKey) return true;

  const authHeader = req.headers['authorization'] || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return false;
  return match[1] === apiKey;
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

async function handleChangelog(
  req: http.IncomingMessage,
  res: http.ServerResponse
): Promise<void> {
  let body: string;
  try {
    body = await readBody(req);
  } catch {
    sendJSON(res, 400, { error: 'Failed to read request body' });
    return;
  }

  let parsed: {
    repoUrl?: string;
    since?: string;
    until?: string;
    version?: string;
    format?: string;
  };
  try {
    parsed = JSON.parse(body);
  } catch {
    sendJSON(res, 400, { error: 'Invalid JSON body' });
    return;
  }

  // Validate and sanitize the repo URL
  let safeUrl: string;
  try {
    safeUrl = sanitizeRepoUrl(parsed.repoUrl || '');
  } catch (err) {
    sendJSON(res, 400, { error: (err as Error).message });
    return;
  }

  const version = parsed.version || 'Unreleased';
  const date = new Date().toISOString().split('T')[0];

  let repoPath: string | null = null;
  try {
    repoPath = cloneRepo(safeUrl);

    const rawCommits = getCommits(repoPath, parsed.since, parsed.until);
    const parsedCommits = rawCommits.map(parseCommit);
    const changelog = formatMarkdown(parsedCommits, version, date);
    const stats = {
      total: parsedCommits.length,
      summary: formatStats(parsedCommits),
    };

    sendJSON(res, 200, { changelog, stats });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    sendJSON(res, 500, { error: message });
  } finally {
    if (repoPath) {
      fs.rmSync(repoPath, { recursive: true, force: true });
    }
  }
}

// ---------------------------------------------------------------------------
// Main request router
// ---------------------------------------------------------------------------

async function onRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse
): Promise<void> {
  const ip = getClientIp(req);
  const method = req.method || 'GET';
  const url = req.url || '/';

  // Health check — no auth, no rate limiting
  if (method === 'GET' && url === '/health') {
    sendJSON(res, 200, { status: 'ok' });
    return;
  }

  // Rate limiting
  if (!allowRequest(ip)) {
    sendJSON(res, 429, { error: 'Too Many Requests' });
    return;
  }

  // Auth
  if (!checkAuth(req)) {
    sendJSON(res, 401, { error: 'Unauthorized' });
    return;
  }

  if (method === 'POST' && url === '/api/changelog') {
    await handleChangelog(req, res);
    return;
  }

  sendJSON(res, 404, { error: 'Not Found' });
}

// ---------------------------------------------------------------------------
// Server bootstrap
// ---------------------------------------------------------------------------

export function createServer(): http.Server {
  return http.createServer((req, res) => {
    onRequest(req, res).catch((err) => {
      console.error('Unhandled error:', err);
      if (!res.headersSent) {
        sendJSON(res, 500, { error: 'Internal Server Error' });
      }
    });
  });
}

if (require.main === module) {
  const server = createServer();
  server.listen(PORT, () => {
    console.log(`changegen server listening on port ${PORT}`);
    if (!process.env.CHANGEGEN_API_KEY) {
      console.warn('Warning: CHANGEGEN_API_KEY is not set — authentication is disabled');
    }
  });
}
