"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const http = __importStar(require("http"));
const server_1 = require("../server");
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function request(server, options) {
    return new Promise((resolve, reject) => {
        const addr = server.address();
        const req = http.request({
            hostname: '127.0.0.1',
            port: addr.port,
            path: options.path,
            method: options.method,
            headers: options.headers,
        }, (res) => {
            const chunks = [];
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', () => resolve({
                status: res.statusCode || 0,
                body: Buffer.concat(chunks).toString('utf8'),
            }));
            res.on('error', reject);
        });
        req.on('error', reject);
        if (options.body)
            req.write(options.body);
        req.end();
    });
}
// ---------------------------------------------------------------------------
// sanitizeRepoUrl unit tests
// ---------------------------------------------------------------------------
(0, node_test_1.describe)('sanitizeRepoUrl', () => {
    (0, node_test_1.it)('accepts a valid https URL', () => {
        const result = (0, server_1.sanitizeRepoUrl)('https://github.com/user/repo.git');
        strict_1.default.equal(result, 'https://github.com/user/repo.git');
    });
    (0, node_test_1.it)('accepts a valid http URL', () => {
        const result = (0, server_1.sanitizeRepoUrl)('http://example.com/repo.git');
        strict_1.default.equal(result, 'http://example.com/repo.git');
    });
    (0, node_test_1.it)('strips embedded credentials from URL', () => {
        const result = (0, server_1.sanitizeRepoUrl)('https://user:pass@github.com/user/repo.git');
        strict_1.default.equal(result, 'https://github.com/user/repo.git');
    });
    (0, node_test_1.it)('rejects empty input', () => {
        strict_1.default.throws(() => (0, server_1.sanitizeRepoUrl)(''), /required/i);
    });
    (0, node_test_1.it)('rejects local absolute path', () => {
        strict_1.default.throws(() => (0, server_1.sanitizeRepoUrl)('/etc/passwd'), /not allowed/i);
    });
    (0, node_test_1.it)('rejects tilde path', () => {
        strict_1.default.throws(() => (0, server_1.sanitizeRepoUrl)('~/myrepo'), /not allowed/i);
    });
    (0, node_test_1.it)('rejects relative path', () => {
        strict_1.default.throws(() => (0, server_1.sanitizeRepoUrl)('./myrepo'), /not allowed/i);
    });
    (0, node_test_1.it)('rejects file:// URI', () => {
        strict_1.default.throws(() => (0, server_1.sanitizeRepoUrl)('file:///etc/passwd'), /not allowed/i);
    });
    (0, node_test_1.it)('rejects ssh:// protocol', () => {
        strict_1.default.throws(() => (0, server_1.sanitizeRepoUrl)('ssh://git@github.com/user/repo.git'), /not allowed/i);
    });
    (0, node_test_1.it)('rejects malformed URL', () => {
        strict_1.default.throws(() => (0, server_1.sanitizeRepoUrl)('not a url'), /invalid url/i);
    });
});
// ---------------------------------------------------------------------------
// HTTP server integration tests
// ---------------------------------------------------------------------------
(0, node_test_1.describe)('HTTP server', () => {
    let server;
    (0, node_test_1.before)(() => {
        // Start on a random port; no API key so auth is disabled
        delete process.env.CHANGEGEN_API_KEY;
        delete process.env.STRIPE_SECRET_KEY;
        server = (0, server_1.createServer)();
        return new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    });
    (0, node_test_1.after)(() => {
        return new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
    });
    (0, node_test_1.it)('GET /health returns 200 ok', async () => {
        const res = await request(server, { method: 'GET', path: '/health' });
        strict_1.default.equal(res.status, 200);
        const json = JSON.parse(res.body);
        strict_1.default.equal(json.status, 'ok');
    });
    (0, node_test_1.it)('GET /health returns 200 even with unknown auth header', async () => {
        const res = await request(server, {
            method: 'GET',
            path: '/health',
            headers: { Authorization: 'Bearer bad-key' },
        });
        strict_1.default.equal(res.status, 200);
    });
    (0, node_test_1.it)('POST /api/changelog with bad JSON returns 400', async () => {
        const res = await request(server, {
            method: 'POST',
            path: '/api/changelog',
            headers: { 'Content-Type': 'application/json' },
            body: 'not json',
        });
        strict_1.default.equal(res.status, 400);
        const json = JSON.parse(res.body);
        strict_1.default.ok(json.error);
    });
    (0, node_test_1.it)('POST /api/changelog with missing repoUrl returns 400', async () => {
        const res = await request(server, {
            method: 'POST',
            path: '/api/changelog',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ version: '1.0.0' }),
        });
        strict_1.default.equal(res.status, 400);
        const json = JSON.parse(res.body);
        strict_1.default.ok(json.error);
    });
    (0, node_test_1.it)('POST /api/changelog with local path repoUrl returns 400', async () => {
        const res = await request(server, {
            method: 'POST',
            path: '/api/changelog',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ repoUrl: '/etc/passwd' }),
        });
        strict_1.default.equal(res.status, 400);
        const json = JSON.parse(res.body);
        strict_1.default.match(json.error, /not allowed/i);
    });
    (0, node_test_1.it)('unknown route returns 404', async () => {
        const res = await request(server, { method: 'GET', path: '/unknown' });
        strict_1.default.equal(res.status, 404);
    });
    (0, node_test_1.it)('POST /api/subscribe returns 503 when Stripe is not configured', async () => {
        const res = await request(server, {
            method: 'POST',
            path: '/api/subscribe',
        });
        strict_1.default.equal(res.status, 503);
        const json = JSON.parse(res.body);
        strict_1.default.match(json.error, /stripe is not configured/i);
    });
    (0, node_test_1.it)('POST /api/webhook returns 503 when webhook secret is not configured', async () => {
        const res = await request(server, {
            method: 'POST',
            path: '/api/webhook',
            headers: { 'Content-Type': 'application/json' },
            body: '{}',
        });
        strict_1.default.equal(res.status, 503);
        const json = JSON.parse(res.body);
        strict_1.default.match(json.error, /webhook secret is not configured/i);
    });
});
(0, node_test_1.describe)('HTTP server auth', () => {
    let server;
    (0, node_test_1.before)(() => {
        process.env.CHANGEGEN_API_KEY = 'test-secret-key';
        server = (0, server_1.createServer)();
        return new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    });
    (0, node_test_1.after)(() => {
        delete process.env.CHANGEGEN_API_KEY;
        return new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
    });
    (0, node_test_1.it)('request without auth header returns 401', async () => {
        const res = await request(server, {
            method: 'POST',
            path: '/api/changelog',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ repoUrl: 'https://github.com/user/repo.git' }),
        });
        strict_1.default.equal(res.status, 401);
    });
    (0, node_test_1.it)('request with wrong API key returns 401', async () => {
        const res = await request(server, {
            method: 'POST',
            path: '/api/changelog',
            headers: {
                'Content-Type': 'application/json',
                Authorization: 'Bearer wrong-key',
            },
            body: JSON.stringify({ repoUrl: 'https://github.com/user/repo.git' }),
        });
        strict_1.default.equal(res.status, 401);
    });
    (0, node_test_1.it)('GET /health bypasses auth', async () => {
        const res = await request(server, { method: 'GET', path: '/health' });
        strict_1.default.equal(res.status, 200);
    });
});
//# sourceMappingURL=server.test.js.map