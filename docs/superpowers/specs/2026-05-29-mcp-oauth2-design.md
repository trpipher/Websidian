# MCP OAuth 2.1 Authorization — Design Spec

**Date:** 2026-05-29
**Status:** Approved
**Scope:** Replace static MCP bearer tokens with OAuth 2.1 + PKCE so any spec-compliant MCP client (Claude Desktop, etc.) can authorize as a real user via the existing Better Auth login flow.

---

## Goal

When an MCP client (e.g. Claude Desktop) connects to the Websidian MCP server with no token, it should be able to discover the authorization server, redirect the user to log in through the existing web app, and receive a JWT access token scoped to that user. All subsequent tool calls are authenticated with that JWT — no manual token copying, no static credentials in config files.

---

## Architecture

Two servers play distinct OAuth roles:

| Server | Role | Port |
|---|---|---|
| `apps/sync` | Authorization Server + Resource Metadata (via MCP) | 1235 |
| `apps/mcp` | Resource Server | 3100 |

JWT access tokens are signed with `BETTER_AUTH_SECRET` (HS256, already in `.env`). No new secrets needed.

---

## End-to-End Flow

```
MCP Client                     Sync :1235              MCP :3100
    │                               │                      │
    │  POST /mcp  (no token)        │                      │
    │──────────────────────────────────────────────────►   │
    │  ◄── 401 WWW-Authenticate: Bearer resource_metadata= │
    │        "http://localhost:3100/.well-known/..."        │
    │                               │                      │
    │  GET /.well-known/oauth-protected-resource            │
    │──────────────────────────────────────────────────►   │
    │  ◄── { authorization_servers: ["http://...1235"] }    │
    │                               │                      │
    │  GET /.well-known/oauth-authorization-server          │
    │──────────────────────────►    │                      │
    │  ◄── { authorization_endpoint, token_endpoint, ... } │
    │                               │                      │
    │  POST /oauth/register         │                      │
    │──────────────────────────►    │                      │
    │  ◄── { client_id }            │                      │
    │                               │                      │
    │  browser → GET /oauth/authorize?code_challenge=...   │
    │──────────────────────────►    │                      │
    │    [no session → 302 to web app login → returns here]│
    │    [session exists → auto-approve]                   │
    │  ◄── 302 redirect_uri?code=ABC&state=...             │
    │                               │                      │
    │  POST /oauth/token {code, code_verifier}             │
    │──────────────────────────►    │                      │
    │  ◄── { access_token (JWT), expires_in: 2592000 }     │
    │                               │                      │
    │  POST /mcp  Authorization: Bearer <JWT>              │
    │──────────────────────────────────────────────────►   │
    │              [validate JWT locally, extract userId]  │
    │  ◄── tool response                                   │
```

---

## Authorization Server (sync server additions)

### New SQLite tables

```sql
CREATE TABLE IF NOT EXISTS oauth_clients (
  client_id   TEXT PRIMARY KEY,
  client_name TEXT NOT NULL DEFAULT '',
  redirect_uris TEXT NOT NULL,   -- JSON array
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS oauth_codes (
  code                  TEXT PRIMARY KEY,
  client_id             TEXT NOT NULL,
  user_id               TEXT NOT NULL,
  redirect_uri          TEXT NOT NULL,
  code_challenge        TEXT NOT NULL,
  expires_at            TEXT NOT NULL,
  used                  INTEGER NOT NULL DEFAULT 0
);
```

### New routes (`apps/sync/src/routes/oauth.ts`)

| Method | Path | Description |
|---|---|---|
| `GET` | `/.well-known/oauth-authorization-server` | Authorization server metadata |
| `POST` | `/oauth/register` | Dynamic client registration (RFC 7591) |
| `GET` | `/oauth/authorize` | PKCE authorize — checks session, auto-approves, issues code |
| `POST` | `/oauth/token` | Code → JWT exchange |

#### `GET /.well-known/oauth-authorization-server`
Returns static JSON describing the authorization server. Publicly cacheable.

```json
{
  "issuer": "<BETTER_AUTH_URL>",
  "authorization_endpoint": "<BETTER_AUTH_URL>/oauth/authorize",
  "token_endpoint": "<BETTER_AUTH_URL>/oauth/token",
  "registration_endpoint": "<BETTER_AUTH_URL>/oauth/register",
  "response_types_supported": ["code"],
  "grant_types_supported": ["authorization_code"],
  "code_challenge_methods_supported": ["S256"],
  "token_endpoint_auth_methods_supported": ["none"]
}
```

#### `POST /oauth/register`
Accepts `{ client_name?, redirect_uris }`, stores a new `oauth_clients` row, returns `{ client_id, client_name, redirect_uris }`. No client secret — public clients use PKCE instead.

#### `GET /oauth/authorize`
Query params: `client_id`, `redirect_uri`, `response_type=code`, `code_challenge`, `code_challenge_method=S256`, `state`.

1. Validate `client_id` exists and `redirect_uri` matches a registered URI.
2. Check for a Better Auth session cookie (`better-auth.session_token`).
3. **No session** → `302` to `<WEB_URL>?redirect=/oauth/authorize?<original-params-urlencoded>` (web app login page). After successful login the web app reads the `?redirect` param and navigates the browser back to `/oauth/authorize` on the sync server, now with a valid session cookie.
4. **Session exists** → auto-approve: insert `oauth_codes` row (5-min TTL), `302` to `redirect_uri?code=<code>&state=<state>`.

#### `POST /oauth/token`
Body: `{ grant_type: "authorization_code", code, redirect_uri, client_id, code_verifier }`.

1. Look up code, verify not used and not expired.
2. Verify `BASE64URL(SHA256(code_verifier)) === code_challenge`.
3. Mark code `used = 1`.
4. Sign JWT: `{ sub: userId, name: userName, iat, exp: now + 30 days }` with `BETTER_AUTH_SECRET` (HS256).
5. Return `{ access_token, token_type: "bearer", expires_in: 2592000 }`.

---

## Resource Server (MCP server changes)

### New endpoint

`GET /.well-known/oauth-protected-resource` — served by the MCP HTTP server:
```json
{
  "resource": "<MCP server URL>",
  "authorization_servers": ["<BETTER_AUTH_URL>"]
}
```

### Auth middleware

Every request to `/mcp`:

1. Extract `Authorization: Bearer <token>`.
2. **No token** → `401` with header `WWW-Authenticate: Bearer resource_metadata="<MCP_URL>/.well-known/oauth-protected-resource"`.
3. **Token matches `MCP_BEARER` env var** (dev bypass) → proceed with `userId = 'dev'`, `userToken = token`.
4. **JWT** → verify signature (`BETTER_AUTH_SECRET`, HS256) + expiry → extract `{ sub: userId, name }` → proceed.
5. **Invalid/expired** → `401`.

### Per-request server instances

A `buildMcpServer(userId, userToken)` factory creates a new `McpServer` per authenticated request with `userId` and `userToken` captured in closures. The instance is discarded after the response. No shared mutable state across requests.

```typescript
function buildMcpServer(userId: string, userToken: string): McpServer {
  const server = new McpServer({ name: 'websidian', version: '0.1.0' })
  // tools close over userToken for REST calls
  server.registerTool('list_projects', ..., () => listProjects(userToken))
  // ...
  return server
}
```

---

## Tool context

Tools split by auth method:

| Tool | Auth used | Reason |
|---|---|---|
| `list_projects` | User JWT (forwarded) | REST call, user-scoped |
| `list_notes` | User JWT (forwarded) | REST call, project-scoped |
| `search_notes` | User JWT (forwarded) | REST call, project-scoped |
| `create_note` | User JWT (forwarded) | REST call, project-scoped |
| `read_note` | `AI_BOT_TOKEN` | Yjs WebSocket — shows AI presence |
| `append_to_note` | `AI_BOT_TOKEN` | Yjs WebSocket — shows AI presence |
| `edit_note` | `AI_BOT_TOKEN` | Yjs WebSocket — shows AI presence |

`userId` is never accepted as a tool input parameter. Identity is always derived server-side from the validated token.

`api-client.ts` is updated: `userHeaders()` accepts a `token` string argument instead of reading `process.env.MCP_USER_TOKEN`. `MCP_USER_TOKEN` env var is removed from `.env.example`.

---

## Token lifecycle

| Token | TTL | Storage |
|---|---|---|
| Authorization code | 5 minutes | `oauth_codes` table, deleted after use |
| JWT access token | 30 days | Stateless (client-side only) |
| Dynamic client registration | Permanent | `oauth_clients` table |

No refresh tokens. On JWT expiry the client re-runs the full OAuth flow (one browser redirect).

---

## Environment variables

| Variable | Purpose | Change |
|---|---|---|
| `BETTER_AUTH_SECRET` | JWT signing key | Existing — reused |
| `BETTER_AUTH_URL` | Issuer URL + login redirect base | Existing — reused |
| `AI_BOT_TOKEN` | Yjs WebSocket bot auth | Existing — unchanged |
| `MCP_PORT` | MCP server port | Existing — unchanged |
| `MCP_BEARER` | Dev bypass token (optional) | Existing — kept as escape hatch |
| `MCP_URL` | Public URL of MCP server (for metadata) | **New** — defaults to `http://localhost:3100` |
| `WEB_URL` | Web app base URL (login page redirect target) | **New** — defaults to `http://localhost:5173` |
| `MCP_USER_TOKEN` | Static user token | **Removed** |

---

## Files changed

```
apps/sync/src/schema.sql              MODIFY — add oauth_clients, oauth_codes tables
apps/sync/src/routes/oauth.ts         CREATE — register, authorize, token endpoints
apps/sync/src/server.ts               MODIFY — mount oauth router + /.well-known/oauth-authorization-server
apps/mcp/src/server.ts                MODIFY — auth middleware, per-request server, /.well-known/oauth-protected-resource
apps/mcp/src/api-client.ts            MODIFY — accept token param, remove MCP_USER_TOKEN
apps/mcp/src/tools/list-notes.ts      MODIFY — accept token param
apps/mcp/src/tools/search-notes.ts    MODIFY — accept token param
apps/mcp/src/tools/list-projects.ts   MODIFY — accept token param
apps/mcp/src/tools/create-note.ts     MODIFY — accept token param
apps/web/src/components/LoginPage.tsx MODIFY — read ?redirect param, navigate there after successful login
.env.example                          MODIFY — add MCP_URL, WEB_URL, remove MCP_USER_TOKEN
```

---

## Acceptance criteria

- [ ] `pnpm --filter @websidian/mcp exec tsc --noEmit` passes
- [ ] `pnpm --filter @websidian/sync exec tsc --noEmit` passes
- [ ] `curl http://localhost:3100/.well-known/oauth-protected-resource` returns valid JSON
- [ ] `curl http://localhost:1235/.well-known/oauth-authorization-server` returns valid JSON
- [ ] `POST /oauth/register` returns a `client_id`
- [ ] Full browser authorize flow issues a code and redirects
- [ ] `POST /oauth/token` with valid code + verifier returns a JWT
- [ ] `POST /mcp` with no token returns `401` with correct `WWW-Authenticate` header
- [ ] `POST /mcp` with valid JWT returns tool results scoped to the authenticated user
- [ ] `POST /mcp` with `MCP_BEARER` dev token works without going through OAuth
- [ ] Expired/invalid JWT returns `401`
