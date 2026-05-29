import { auth } from './routes/auth.js'

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

  const session = await auth.api.getSession({
    headers: new Headers({ cookie: `better-auth.session_token=${token}` }),
  })

  if (!session?.user) {
    throw new Error('Unauthorized')
  }

  return { userId: session.user.id, role: 'user' }
}
