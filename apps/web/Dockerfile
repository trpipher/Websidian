FROM node:24-alpine AS build
RUN npm install -g pnpm

ARG DOMAIN=localhost
ARG VITE_API_URL=https://${DOMAIN}
ARG VITE_SYNC_URL=wss://${DOMAIN}
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_SYNC_URL=${VITE_SYNC_URL}

WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/ ./packages/
COPY apps/web/ ./apps/web/

RUN pnpm install --frozen-lockfile --filter @websidian/web...
RUN pnpm --filter @websidian/web build

FROM nginx:alpine
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
