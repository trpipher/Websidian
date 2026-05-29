import { z } from 'zod'
import { openYjsDoc } from '../yjs-client.js'

const API_URL = process.env.API_URL ?? 'http://localhost:1235'
const AI_BOT_TOKEN = process.env.AI_BOT_TOKEN ?? 'dev-ai-bot-token'

export const createNoteSchema = z.object({
  projectId: z.string().describe('Project ID to create the note in'),
  title: z.string().describe('Note title'),
  content: z.string().optional().describe('Initial markdown content'),
})

export async function createNote({ projectId, title, content }: z.infer<typeof createNoteSchema>): Promise<string> {
  const res = await fetch(`${API_URL}/api/projects/${projectId}/notes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${AI_BOT_TOKEN}` },
    body: JSON.stringify({ path: `${title.replace(/[^a-z0-9]+/gi, '-')}.md`, title }),
  })
  if (!res.ok) throw new Error(`API error: ${res.status} ${await res.text()}`)
  const note = await res.json()

  if (content) {
    const client = await openYjsDoc(note.id)
    client.yText.insert(0, content)
    await new Promise(r => setTimeout(r, 500))
    client.destroy()
  }

  return `Created note ${note.id}: "${title}"`
}
