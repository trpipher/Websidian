export const API_URL = process.env.API_URL ?? 'http://localhost:1235'

export function userHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }
}

export async function apiGet(path: string, token: string): Promise<unknown> {
  const res = await fetch(`${API_URL}${path}`, { headers: userHeaders(token) })
  if (!res.ok) throw new Error(`API GET ${path} → ${res.status} ${await res.text()}`)
  return res.json()
}

export async function apiPost(path: string, body: unknown, token: string): Promise<unknown> {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: userHeaders(token),
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`API POST ${path} → ${res.status} ${await res.text()}`)
  return res.json()
}

export async function apiPatch(path: string, body: unknown, token: string): Promise<unknown> {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'PATCH',
    headers: userHeaders(token),
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`API PATCH ${path} → ${res.status} ${await res.text()}`)
  return res.json()
}
