# documenso-mcp

Model Context Protocol (MCP) server for **documenso**, part of the Intelli-Verse engagement stack.

- Transport: MCP JSON-RPC 2.0 over HTTP (`POST /`), liveness at `GET /healthz`.
- Auth: **per-request** — the caller passes the documenso API token via `Authorization: Bearer <token>`.
  No ambient credential is baked into the image, so one deployment serves every app-id tenant
  (each request is scoped by its own token).
- Dependency-free: Node 20 built-ins + global `fetch`. No `npm install`.

## Run locally
```bash
PORT=3030 node server.js
curl -s localhost:3030/healthz
curl -s -X POST localhost:3030/ -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

## Tools
See `tools.js` for the full catalog and input schemas.

## Deploy
Image is built from this folder and pushed to ECR; Kubernetes manifest lives in
`intelli-verse-kube-infra/documenso-mcp/deployment.yaml` (namespace `aicart`).
