import { z } from 'zod'
import { apiPatch } from '../api-client.js'

export const moveNoteSchema = z.object({
  projectId: z.string().describe('Project ID'),
  noteId: z.string().describe('ID of the note or folder to move'),
  folderId: z.string().nullable().describe('Destination folder ID, or null to move to the project root. Get folder IDs from list_notes (items where isFolder is true).'),
})

export async function moveNote(
  { projectId, noteId, folderId }: z.infer<typeof moveNoteSchema>,
  token: string,
): Promise<string> {
  await apiPatch(
    `/api/projects/${projectId}/notes/${noteId}`,
    { parentId: folderId },
    token,
  )
  const destination = folderId ? `folder ${folderId}` : 'project root'
  return `Moved note ${noteId} to ${destination}`
}
