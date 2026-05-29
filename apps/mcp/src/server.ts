import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { createServer } from 'node:http'
import { listNotes, listNotesSchema } from './tools/list-notes.js'
import { searchNotes, searchNotesSchema } from './tools/search-notes.js'
import { readNote, readNoteSchema } from './tools/read-note.js'
import { createNote, createNoteSchema } from './tools/create-note.js'
import { appendNote, appendNoteSchema } from './tools/append-note.js'
import { editNote, editNoteSchema } from './tools/edit-note.js'

const PORT = parseInt(process.env.MCP_PORT ?? '3100')
const MCP_BEARER = process.env.MCP_BEARER ?? 'dev-mcp-bearer'

const mcpServer = new McpServer({ name: 'websidian', version: '0.1.0' })

mcpServer.registerTool('list_notes', {
  description: 'List all notes in a project',
  inputSchema: listNotesSchema,
}, async (args) => ({
  content: [{ type: 'text', text: await listNotes(args) }],
}))

mcpServer.registerTool('search_notes', {
  description: 'Full-text search notes in a project',
  inputSchema: searchNotesSchema,
}, async (args) => ({
  content: [{ type: 'text', text: await searchNotes(args) }],
}))

mcpServer.registerTool('read_note', {
  description: 'Read live content of a note via Yjs',
  inputSchema: readNoteSchema,
}, async (args) => ({
  content: [{ type: 'text', text: await readNote(args) }],
}))

mcpServer.registerTool('create_note', {
  description: 'Create a new note with optional initial content',
  inputSchema: createNoteSchema,
}, async (args) => ({
  content: [{ type: 'text', text: await createNote(args) }],
}))

mcpServer.registerTool('append_to_note', {
  description: 'Append markdown to a note (visible to live editors)',
  inputSchema: appendNoteSchema,
}, async (args) => ({
  content: [{ type: 'text', text: await appendNote(args) }],
}))

mcpServer.registerTool('edit_note', {
  description: 'Find-and-replace text in a note using minimal Yjs ops',
  inputSchema: editNoteSchema,
}, async (args) => ({
  content: [{ type: 'text', text: await editNote(args) }],
}))

const httpServer = createServer(async (req, res) => {
  // Auth check
  const auth = req.headers.authorization
  if (!auth || auth !== `Bearer ${MCP_BEARER}`) {
    res.writeHead(401, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Unauthorized' }))
    return
  }

  if (req.url === '/mcp') {
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })
    await mcpServer.connect(transport)

    // Parse body
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', async () => {
      const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : undefined
      await transport.handleRequest(req, res, body)
    })
  } else {
    res.writeHead(404)
    res.end()
  }
})

httpServer.listen(PORT, () => console.log(`MCP server on http://localhost:${PORT}/mcp`))
