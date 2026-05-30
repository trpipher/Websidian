FROM node:24-alpine AS base
RUN apk add --no-cache python3 make g++
RUN npm install -g pnpm

WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY packages/ ./packages/
COPY apps/sync/ ./apps/sync/

RUN pnpm install --frozen-lockfile --filter @websidian/sync...
RUN pnpm --filter @websidian/sync build

FROM node:24-alpine
WORKDIR /app
COPY --from=base /app/apps/sync/dist ./dist
# schema.sql must live alongside compiled JS so __dirname resolution works
COPY --from=base /app/apps/sync/src/schema.sql ./dist/schema.sql
COPY --from=base /app/node_modules ./node_modules

ENV NODE_ENV=production
EXPOSE 1234 1235
CMD ["node", "dist/server.js"]
