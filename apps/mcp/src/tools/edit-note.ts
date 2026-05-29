import { z } from 'zod'
import { openYjsDoc } from '../yjs-client.js'

export const editNoteSchema = z.object({
  id: z.string().describe('Note ID'),
  find: z.string().describe('Exact string to find (must be unique in the document)'),
  replace: z.string().describe('Replacement string'),
})

export async function editNote({ id, find, replace }: z.infer<typeof editNoteSchema>): Promise<string> {
  const client = await openYjsDoc(id)
  const current = client.yText.toString()
  const idx = current.indexOf(find)
  if (idx === -1) {
    client.destroy()
    throw new Error(`String not found in note: "${find.slice(0, 50)}"`)
  }
  client.doc.transact(() => {
    client.yText.delete(idx, find.length)
    client.yText.insert(idx, replace)
  })
  await new Promise(r => setTimeout(r, 500))
  client.destroy()
  return `Replaced "${find.slice(0, 30)}" → "${replace.slice(0, 30)}" in note ${id}`
}
