import { z } from 'zod'
import { apiGet } from '../api-client.js'

export const listImagesSchema = z.object({
  projectId: z.string().describe('Project ID'),
})

export async function listImages(
  { projectId }: z.infer<typeof listImagesSchema>,
  token: string,
): Promise<string> {
  const images = await apiGet(`/api/projects/${projectId}/images`, token)
  return JSON.stringify(images, null, 2)
}
