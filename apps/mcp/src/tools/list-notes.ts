import { z } from 'zod'
import { apiGet } from '../api-client.js'

export const listNotesSchema = z.object({
  projectId: z.string().describe('Project ID (get IDs from list_projects)'),
})

export async function listNotes(
  { projectId }: z.infer<typeof listNotesSchema>,
  token: string,
): Promise<string> {
  const notes = await apiGet(`/api/projects/${projectId}/notes`, token)
  return JSON.stringify(notes, null, 2)
}
