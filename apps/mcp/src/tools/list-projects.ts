import { z } from 'zod'
import { apiGet } from '../api-client.js'

export const listProjectsSchema = z.object({})

export async function listProjects(token: string): Promise<string> {
  const projects = await apiGet('/api/projects', token)
  return JSON.stringify(projects, null, 2)
}
