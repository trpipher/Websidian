FROM node:24-alpine AS base
RUN npm install -g pnpm

WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY packages/ ./packages/
COPY apps/mcp/ ./apps/mcp/

RUN pnpm install --frozen-lockfile --filter @websidian/mcp...
RUN pnpm --filter @websidian/mcp build
# pnpm deploy creates a flat, symlink-free node_modules safe for Docker
RUN pnpm deploy --filter @websidian/mcp --prod /deploy/mcp

FROM node:24-alpine
WORKDIR /app
COPY --from=base /deploy/mcp/node_modules ./node_modules
COPY --from=base /app/apps/mcp/dist ./dist

ENV NODE_ENV=production
EXPOSE 3100
CMD ["node", "dist/server.js"]
