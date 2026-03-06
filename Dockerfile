# syntax=docker/dockerfile:1

FROM node:24-alpine AS builder
WORKDIR /app

# Install deps
COPY package.json package-lock.json ./
RUN npm ci

# Copy sources and build the two services
COPY . .
RUN npx nx run-many -t build --projects=web --configuration=production

# SSR runtime
FROM node:24-alpine AS ssr-runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/dist/web ./dist/web
CMD ["node", "dist/web/server/server.mjs"]
