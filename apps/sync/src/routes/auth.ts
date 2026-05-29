import { betterAuth } from 'better-auth'
import { Hono } from 'hono'
import { db as sqliteDb } from '../db.js'

// Cast to any to avoid TypeScript leaking the BetterSqlite3.Database internal type
// through the exported `auth` symbol (TS4023). The runtime value is the same object.
export const auth = betterAuth({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  database: sqliteDb as any,
  secret: process.env.BETTER_AUTH_SECRET ?? 'dev-secret',
  baseURL: process.env.BETTER_AUTH_URL ?? 'http://localhost:1235',
  trustedOrigins: (process.env.TRUSTED_ORIGINS ?? 'http://localhost:3000').split(','),
  emailAndPassword: { enabled: true },
  socialProviders: {
    ...(process.env.GITHUB_CLIENT_ID ? {
      github: { clientId: process.env.GITHUB_CLIENT_ID!, clientSecret: process.env.GITHUB_CLIENT_SECRET! },
    } : {}),
    ...(process.env.DISCORD_CLIENT_ID ? {
      discord: { clientId: process.env.DISCORD_CLIENT_ID!, clientSecret: process.env.DISCORD_CLIENT_SECRET! },
    } : {}),
  },
})

export const authRouter = new Hono()
authRouter.all('/*', (c) => auth.handler(c.req.raw))
