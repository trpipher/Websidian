FROM node:24-alpine AS base
RUN npm install -g pnpm

WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/ ./packages/
COPY apps/mcp/ ./apps/mcp/

RUN pnpm install --frozen-lockfile --filter @websidian/mcp...
RUN pnpm --filter @websidian/mcp build

FROM node:24-alpine
WORKDIR /app
COPY --from=base /app/apps/mcp/dist ./dist
COPY --from=base /app/node_modules ./node_modules

ENV NODE_ENV=production
EXPOSE 3100
CMD ["node", "dist/server.js"]
