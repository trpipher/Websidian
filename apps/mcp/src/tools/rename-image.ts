import { z } from 'zod'
import { apiPatch } from '../api-client.js'

export const renameImageSchema = z.object({
  projectId: z.string().describe('Project ID'),
  imageId: z.string().describe('Image ID (get IDs from list_images)'),
  filename: z.string().describe('New filename including extension, e.g. "diagram.png"'),
})

export async function renameImage(
  { projectId, imageId, filename }: z.infer<typeof renameImageSchema>,
  token: string,
): Promise<string> {
  await apiPatch(
    `/api/projects/${projectId}/images/${imageId}`,
    { filename },
    token,
  )
  return `Renamed image ${imageId} to "${filename}"`
}
