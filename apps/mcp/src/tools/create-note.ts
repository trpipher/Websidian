import { z } from 'zod'
import { openYjsDoc } from '../yjs-client.js'
import { apiPost } from '../api-client.js'
import type { NoteMeta } from '@websidian/shared'

export const createNoteSchema = z.object({
  projectId: z.string().describe('Project ID to create the note in (get IDs from list_projects)'),
  title: z.string().describe('Note title'),
  content: z.string().optional().describe('Initial markdown content'),
})

export async function createNote({ projectId, title, content }: z.infer<typeof createNoteSchema>): Promise<string> {
  const note = await apiPost(`/api/projects/${projectId}/notes`, {
    path: `${title.replace(/[^a-z0-9]+/gi, '-')}.md`,
    title,
  }) as NoteMeta

  if (content) {
    const client = await openYjsDoc(note.id)
    client.yText.insert(0, content)
    await new Promise(r => setTimeout(r, 500))
    client.destroy()
  }

  return `Created note ${note.id}: "${title}"`
}
