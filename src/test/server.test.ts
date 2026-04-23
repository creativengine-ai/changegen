import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import * as http from 'http';
import { createServer, sanitizeRepoUrl } from '../server';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function request(
  server: http.Server,
  options: {
    method: string;
    path: string;
    headers?: Record<string, string>;
    body?: string;
  }
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const addr = server.address() as { port: number };
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: addr.port,
        path: options.path,
        method: options.method,
        headers: options.headers,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () =>
          resolve({
            status: res.statusCode || 0,
            body: Buffer.concat(chunks).toString('utf8'),
          })
        );
        res.on('error', reject);
      }
    );
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// sanitizeRepoUrl unit tests
// ---------------------------------------------------------------------------

describe('sanitizeRepoUrl', () => {
  it('accepts a valid https URL', () => {
    const result = sanitizeRepoUrl('https://github.com/user/repo.git');
    assert.equal(result, 'https://github.com/user/repo.git');
  });

  it('accepts a valid http URL', () => {
    const result = sanitizeRepoUrl('http://example.com/repo.git');
    assert.equal(result, 'http://example.com/repo.git');
  });

  it('strips embedded credentials from URL', () => {
    const result = sanitizeRepoUrl('https://user:pass@github.com/user/repo.git');
    assert.equal(result, 'https://github.com/user/repo.git');
  });

  it('rejects empty input', () => {
    assert.throws(() => sanitizeRepoUrl(''), /required/i);
  });

  it('rejects local absolute path', () => {
    assert.throws(() => sanitizeRepoUrl('/etc/passwd'), /not allowed/i);
  });

  it('rejects tilde path', () => {
    assert.throws(() => sanitizeRepoUrl('~/myrepo'), /not allowed/i);
  });

  it('rejects relative path', () => {
    assert.throws(() => sanitizeRepoUrl('./myrepo'), /not allowed/i);
  });

  it('rejects file:// URI', () => {
    assert.throws(() => sanitizeRepoUrl('file:///etc/passwd'), /not allowed/i);
  });

  it('rejects ssh:// protocol', () => {
    assert.throws(() => sanitizeRepoUrl('ssh://git@github.com/user/repo.git'), /not allowed/i);
  });

  it('rejects malformed URL', () => {
    assert.throws(() => sanitizeRepoUrl('not a url'), /invalid url/i);
  });
});

// ---------------------------------------------------------------------------
// HTTP server integration tests
// ---------------------------------------------------------------------------

describe('HTTP server', () => {
  let server: http.Server;

  before(() => {
    // Start on a random port; no API key so auth is disabled
    delete process.env.CHANGEGEN_API_KEY;
    delete process.env.GUMROAD_SELLER_ID;
    server = createServer();
    return new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  });

  after(() => {
    return new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve()))
    );
  });

  it('GET /health returns 200 ok', async () => {
    const res = await request(server, { method: 'GET', path: '/health' });
    assert.equal(res.status, 200);
    const json = JSON.parse(res.body);
    assert.equal(json.status, 'ok');
  });

  it('GET /health returns 200 even with unknown auth header', async () => {
    const res = await request(server, {
      method: 'GET',
      path: '/health',
      headers: { Authorization: 'Bearer bad-key' },
    });
    assert.equal(res.status, 200);
  });

  it('POST /api/changelog with bad JSON returns 400', async () => {
    const res = await request(server, {
      method: 'POST',
      path: '/api/changelog',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    });
    assert.equal(res.status, 400);
    const json = JSON.parse(res.body);
    assert.ok(json.error);
  });

  it('POST /api/changelog with missing repoUrl returns 400', async () => {
    const res = await request(server, {
      method: 'POST',
      path: '/api/changelog',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ version: '1.0.0' }),
    });
    assert.equal(res.status, 400);
    const json = JSON.parse(res.body);
    assert.ok(json.error);
  });

  it('POST /api/changelog with local path repoUrl returns 400', async () => {
    const res = await request(server, {
      method: 'POST',
      path: '/api/changelog',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repoUrl: '/etc/passwd' }),
    });
    assert.equal(res.status, 400);
    const json = JSON.parse(res.body);
    assert.match(json.error, /not allowed/i);
  });

  it('unknown route returns 404', async () => {
    const res = await request(server, { method: 'GET', path: '/unknown' });
    assert.equal(res.status, 404);
  });

  it('POST /api/subscribe returns 503 when Gumroad is not configured', async () => {
    const res = await request(server, {
      method: 'POST',
      path: '/api/subscribe',
    });
    assert.equal(res.status, 503);
    const json = JSON.parse(res.body);
    assert.match(json.error, /gumroad is not configured/i);
  });

  it('POST /api/webhook returns 503 when webhook is not configured', async () => {
    const res = await request(server, {
      method: 'POST',
      path: '/api/webhook',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'seller_id=test',
    });
    assert.equal(res.status, 503);
    const json = JSON.parse(res.body);
    assert.match(json.error, /webhook is not configured/i);
  });
});

describe('HTTP server auth', () => {
  let server: http.Server;

  before(() => {
    process.env.CHANGEGEN_API_KEY = 'test-secret-key';
    server = createServer();
    return new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  });

  after(() => {
    delete process.env.CHANGEGEN_API_KEY;
    return new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve()))
    );
  });

  it('request without auth header returns 401', async () => {
    const res = await request(server, {
      method: 'POST',
      path: '/api/changelog',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repoUrl: 'https://github.com/user/repo.git' }),
    });
    assert.equal(res.status, 401);
  });

  it('request with wrong API key returns 401', async () => {
    const res = await request(server, {
      method: 'POST',
      path: '/api/changelog',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer wrong-key',
      },
      body: JSON.stringify({ repoUrl: 'https://github.com/user/repo.git' }),
    });
    assert.equal(res.status, 401);
  });

  it('GET /health bypasses auth', async () => {
    const res = await request(server, { method: 'GET', path: '/health' });
    assert.equal(res.status, 200);
  });
});
