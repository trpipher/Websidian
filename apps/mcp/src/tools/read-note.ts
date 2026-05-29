import { z } from 'zod'
import { openYjsDoc } from '../yjs-client.js'

export const readNoteSchema = z.object({
  id: z.string().describe('Note ID'),
})

export async function readNote({ id }: z.infer<typeof readNoteSchema>): Promise<string> {
  const client = await openYjsDoc(id)
  const content = client.yText.toString()
  client.destroy()
  return content || '(empty note)'
}
