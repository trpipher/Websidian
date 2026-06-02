import { z } from 'zod'
import { openYjsDoc } from '../yjs-client.js'
import { apiPost } from '../api-client.js'
import type { NoteMeta } from '@websidian/shared'

export const createNoteSchema = z.object({
  projectId: z.string().describe('Project ID (get IDs from list_projects)'),
  title: z.string().describe('Note title'),
  content: z.string().optional().describe('Initial markdown content'),
  folderId: z.string().optional().describe('Parent folder ID. Get folder IDs from list_notes (items where isFolder is true). Omit to create in the project root.'),
})

export async function createNote(
  { projectId, title, content, folderId }: z.infer<typeof createNoteSchema>,
  token: string,
): Promise<string> {
  const note = await apiPost(
    `/api/projects/${projectId}/notes`,
    { path: `${title.replace(/[^a-z0-9]+/gi, '-')}.md`, title, parentId: folderId ?? null },
    token,
  ) as NoteMeta

  if (content) {
    const client = await openYjsDoc(note.id)
    client.yText.insert(0, content)
    await new Promise(r => setTimeout(r, 500))
    client.destroy()
  }

  return `Created note ${note.id}: "${title}"`
}
