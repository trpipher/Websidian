import { z } from 'zod'
import { apiGet } from '../api-client.js'

export const searchNotesSchema = z.object({
  projectId: z.string().describe('Project ID (get IDs from list_projects)'),
  query: z.string().describe('Full-text search query'),
})

export async function searchNotes(
  { projectId, query }: z.infer<typeof searchNotesSchema>,
  token: string,
): Promise<string> {
  const results = await apiGet(
    `/api/projects/${projectId}/notes/search?q=${encodeURIComponent(query)}`,
    token,
  )
  return JSON.stringify(results, null, 2)
}
