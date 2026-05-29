import { z } from 'zod'
import { openYjsDoc } from '../yjs-client.js'

export const appendNoteSchema = z.object({
  id: z.string().describe('Note ID'),
  content: z.string().describe('Markdown content to append'),
})

export async function appendNote({ id, content }: z.infer<typeof appendNoteSchema>): Promise<string> {
  const client = await openYjsDoc(id)
  const currentLen = client.yText.length
  const separator = currentLen > 0 && !client.yText.toString().endsWith('\n') ? '\n' : ''
  client.yText.insert(currentLen, separator + content)
  await new Promise(r => setTimeout(r, 500))
  client.destroy()
  return `Appended ${content.length} chars to note ${id}`
}
