import { db } from './db.js'

const AI_BOT_TOKEN = process.env.AI_BOT_TOKEN ?? 'dev-ai-bot-token'

export async function onAuthenticate({
  token,
}: {
  token: string
  requestParameters: URLSearchParams
}) {
  if (token === AI_BOT_TOKEN) {
    return { userId: 'ai-bot', role: 'ai-bot' }
  }

  const session = db.prepare(
    'SELECT userId FROM session WHERE token = ? AND expiresAt > ?'
  ).get(token, new Date().toISOString()) as { userId: string } | undefined

  if (!session) throw new Error('Unauthorized')

  return { userId: session.userId, role: 'user' }
}
