# syntax=docker/dockerfile:1

FROM node:24-alpine AS builder
WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy workspace config + all package.json files for proper hoisting
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY data-store/functions/package.json ./data-store/functions/

# Install deps (with workspace packages)
RUN pnpm install --frozen-lockfile

# Copy sources and build
COPY . .
RUN pnpm nx run web:build --configuration=production

# SSR runtime
FROM node:24-alpine AS ssr-runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/dist/web ./dist/web
CMD ["node", "dist/web/server/server.mjs"]
