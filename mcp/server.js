#!/usr/bin/env node
// Minimal, dependency-free MCP server (JSON-RPC 2.0 over HTTP) for the
// Intelli-Verse engagement stack. One core, swap `tools.js` per tool.
//
// - GET  /healthz        -> liveness/readiness
// - POST /  (or /mcp)    -> MCP JSON-RPC: initialize, ping, tools/list, tools/call
// - Auth: per-request Bearer token (Authorization header) forwarded to the
//   target API. No ambient credential is baked in.
import http from 'node:http';
import { SERVER, TOOLS } from './tools.js';

const PORT = Number(process.env.PORT || 3030);
const PROTOCOL_VERSION = '2024-11-05';

function send(res, status, body) {
  const data = body === undefined ? '' : JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) });
  res.end(data);
}
const rpcResult = (id, result) => ({ jsonrpc: '2.0', id, result });
const rpcError = (id, code, message, data) => ({ jsonrpc: '2.0', id, error: { code, message, ...(data ? { data } : {}) } });

function toolSpecs() {
  return TOOLS.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema }));
}

async function handleRpc(msg, ctx) {
  const { id, method, params } = msg;
  // Notifications (no id) — ack without a body.
  if (id === undefined || id === null) return undefined;

  switch (method) {
    case 'initialize':
      return rpcResult(id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: { name: SERVER.name, version: SERVER.version },
        instructions: SERVER.instructions || undefined,
      });
    case 'ping':
      return rpcResult(id, {});
    case 'tools/list':
      return rpcResult(id, { tools: toolSpecs() });
    case 'tools/call': {
      const name = params?.name;
      const args = params?.arguments || {};
      const tool = TOOLS.find((t) => t.name === name);
      if (!tool) return rpcError(id, -32602, `Unknown tool: ${name}`);
      try {
        const out = await tool.handler(args, ctx);
        const text = typeof out === 'string' ? out : JSON.stringify(out, null, 2);
        return rpcResult(id, { content: [{ type: 'text', text }] });
      } catch (err) {
        return rpcResult(id, {
          content: [{ type: 'text', text: `Error calling ${name}: ${err.message}` }],
          isError: true,
        });
      }
    }
    default:
      return rpcError(id, -32601, `Method not found: ${method}`);
  }
}

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && (req.url === '/healthz' || req.url === '/health' || req.url === '/ready')) {
    return send(res, 200, { status: 'ok', server: SERVER.name, version: SERVER.version, tools: TOOLS.length });
  }
  if (req.method !== 'POST') return send(res, 405, { error: 'method not allowed' });

  const auth = req.headers['authorization'] || '';
  const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
  const baseUrl = (process.env[SERVER.baseUrlEnv] || SERVER.defaultBaseUrl).replace(/\/+$/, '');

  // Auth header style is per-tool: default Authorization: Bearer <token>,
  // but some APIs (e.g. Chatwoot) use a custom header with no scheme.
  const headerName = SERVER.authHeaderName || 'Authorization';
  const scheme = SERVER.authScheme ?? 'Bearer ';

  // Shared fetch helper for tool handlers (typed errors, JSON parsing).
  const api = async (path, { method = 'GET', body, headers } = {}) => {
    if (!token) throw new Error(`missing token (set Authorization: Bearer <api_token>${headerName !== 'Authorization' ? `; forwarded as ${headerName}` : ''})`);
    // Optional static headers from env (e.g. Supabase apikey for OpenBSP).
    const staticHeaders = typeof SERVER.staticHeaders === 'function' ? SERVER.staticHeaders() : {};
    const r = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        [headerName]: `${scheme}${token}`,
        'Content-Type': 'application/json',
        ...staticHeaders,
        ...(headers || {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const txt = await r.text();
    let parsed; try { parsed = txt ? JSON.parse(txt) : null; } catch { parsed = txt; }
    if (!r.ok) throw new Error(`${r.status} ${r.statusText}: ${typeof parsed === 'string' ? parsed : JSON.stringify(parsed)}`);
    return parsed;
  };

  let raw = '';
  req.on('data', (c) => { raw += c; if (raw.length > 5_000_000) req.destroy(); });
  req.on('end', async () => {
    let msg;
    try { msg = JSON.parse(raw || '{}'); } catch { return send(res, 200, rpcError(null, -32700, 'Parse error')); }
    const ctx = { token, baseUrl, api };
    if (Array.isArray(msg)) { // batch
      const out = (await Promise.all(msg.map((m) => handleRpc(m, ctx)))).filter(Boolean);
      return send(res, 200, out);
    }
    const out = await handleRpc(msg, ctx);
    if (out === undefined) return send(res, 202, undefined);
    return send(res, 200, out);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`${SERVER.name} v${SERVER.version} (MCP/HTTP) listening on :${PORT} — ${TOOLS.length} tools`);
});
