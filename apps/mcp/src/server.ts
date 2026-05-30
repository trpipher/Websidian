import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { listProjects, listProjectsSchema } from './tools/list-projects.js'
import { listNotes, listNotesSchema } from './tools/list-notes.js'
import { searchNotes, searchNotesSchema } from './tools/search-notes.js'
import { readNote, readNoteSchema } from './tools/read-note.js'
import { createNote, createNoteSchema } from './tools/create-note.js'
import { appendNote, appendNoteSchema } from './tools/append-note.js'
import { editNote, editNoteSchema } from './tools/edit-note.js'
import { verifyJwt } from './lib/jwt.js'

const PORT = parseInt(process.env.MCP_PORT ?? '3100')
const MCP_BEARER = process.env.MCP_BEARER
const MCP_URL = process.env.MCP_URL ?? `http://localhost:${PORT}`
const AUTH_SERVER = process.env.BETTER_AUTH_URL ?? 'http://localhost:1235'

function buildMcpServer(userToken: string): McpServer {
  const server = new McpServer({ name: 'websidian', version: '0.1.0' })

  server.registerTool('list_projects', {
    description: 'List all projects the authenticated user has access to. Call this first to get project IDs.',
    inputSchema: listProjectsSchema,
  }, async () => ({
    content: [{ type: 'text', text: await listProjects(userToken) }],
  }))

  server.registerTool('list_notes', {
    description: 'List all notes in a project',
    inputSchema: listNotesSchema,
  }, async (args) => ({
    content: [{ type: 'text', text: await listNotes(args, userToken) }],
  }))

  server.registerTool('search_notes', {
    description: 'Full-text search notes in a project',
    inputSchema: searchNotesSchema,
  }, async (args) => ({
    content: [{ type: 'text', text: await searchNotes(args, userToken) }],
  }))

  server.registerTool('read_note', {
    description: 'Read the live Yjs content of a note',
    inputSchema: readNoteSchema,
  }, async (args) => ({
    content: [{ type: 'text', text: await readNote(args) }],
  }))

  server.registerTool('create_note', {
    description: 'Create a new note with optional initial content',
    inputSchema: createNoteSchema,
  }, async (args) => ({
    content: [{ type: 'text', text: await createNote(args, userToken) }],
  }))

  server.registerTool('append_to_note', {
    description: 'Append markdown to a note (visible to live editors as AI cursor)',
    inputSchema: appendNoteSchema,
  }, async (args) => ({
    content: [{ type: 'text', text: await appendNote(args) }],
  }))

  server.registerTool('edit_note', {
    description: 'Find-and-replace text in a note using minimal Yjs ops',
    inputSchema: editNoteSchema,
  }, async (args) => ({
    content: [{ type: 'text', text: await editNote(args) }],
  }))

  return server
}

function unauthorized(res: ServerResponse, mcpUrl: string): void {
  res.writeHead(401, {
    'Content-Type': 'application/json',
    'WWW-Authenticate': `Bearer resource_metadata="${mcpUrl}/.well-known/oauth-protected-resource"`,
  })
  res.end(JSON.stringify({ error: 'unauthorized' }))
}

const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  // Protected Resource Metadata — public, no auth
  if (req.url === '/.well-known/oauth-protected-resource') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      resource: MCP_URL,
      authorization_servers: [AUTH_SERVER],
    }))
    return
  }

  if (req.url !== '/mcp') {
    res.writeHead(404)
    res.end()
    return
  }

  // Extract Bearer token
  const authHeader = req.headers.authorization ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''

  if (!token) {
    unauthorized(res, MCP_URL)
    return
  }

  // Validate: dev bypass OR JWT
  let userToken: string
  if (MCP_BEARER && token === MCP_BEARER) {
    userToken = token
  } else {
    try {
      verifyJwt(token)
      userToken = token
    } catch {
      unauthorized(res, MCP_URL)
      return
    }
  }

  // Per-request MCP server with userToken in closure
  const mcpServer = buildMcpServer(userToken)
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })
  await mcpServer.connect(transport)

  const chunks: Buffer[] = []
  req.on('data', (chunk: Buffer) => chunks.push(chunk))
  req.on('end', async () => {
    try {
      const body = chunks.length
        ? JSON.parse(Buffer.concat(chunks).toString())
        : undefined
      await transport.handleRequest(req, res, body)
    } catch {
      if (!res.headersSent) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'invalid_request' }))
      }
    }
  })
})

httpServer.listen(PORT, () => console.log(`MCP server on http://localhost:${PORT}/mcp`))
