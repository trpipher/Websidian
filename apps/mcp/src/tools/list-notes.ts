import { z } from 'zod'
import { apiGet } from '../api-client.js'

export const listNotesSchema = z.object({
  projectId: z.string().describe('Project ID to list notes from (get IDs from list_projects)'),
})

export async function listNotes({ projectId }: z.infer<typeof listNotesSchema>): Promise<string> {
  const notes = await apiGet(`/api/projects/${projectId}/notes`)
  return JSON.stringify(notes, null, 2)
}
