// MCP_USER_TOKEN  — user's Better Auth session token (REST API, project-scoped)
// AI_BOT_TOKEN    — hardcoded bot token (Yjs WebSocket only, bypasses project auth)

export const API_URL = process.env.API_URL ?? 'http://localhost:1235'

/** Returns Authorization header for REST calls, using the user's session token. */
export function userHeaders(): HeadersInit {
  const token = process.env.MCP_USER_TOKEN
  if (!token) throw new Error('MCP_USER_TOKEN is not set. Copy your session token from the app and add it to .env.')
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
}

/** Fetch wrapper for user-scoped REST calls. */
export async function apiGet(path: string): Promise<unknown> {
  const res = await fetch(`${API_URL}${path}`, { headers: userHeaders() })
  if (!res.ok) throw new Error(`API ${path} → ${res.status} ${await res.text()}`)
  return res.json()
}

export async function apiPost(path: string, body: unknown): Promise<unknown> {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: userHeaders(),
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`API POST ${path} → ${res.status} ${await res.text()}`)
  return res.json()
}
