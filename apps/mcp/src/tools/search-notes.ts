import { z } from 'zod'

const API_URL = process.env.API_URL ?? 'http://localhost:1235'
const AI_BOT_TOKEN = process.env.AI_BOT_TOKEN ?? 'dev-ai-bot-token'

export const searchNotesSchema = z.object({
  projectId: z.string().describe('Project ID to search in'),
  query: z.string().describe('Full-text search query'),
})

export async function searchNotes({ projectId, query }: z.infer<typeof searchNotesSchema>): Promise<string> {
  const res = await fetch(
    `${API_URL}/api/projects/${projectId}/notes/search?q=${encodeURIComponent(query)}`,
    { headers: { Authorization: `Bearer ${AI_BOT_TOKEN}` } }
  )
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return JSON.stringify(await res.json(), null, 2)
}
