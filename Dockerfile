# syntax=docker/dockerfile:1

FROM node:24-alpine AS builder
WORKDIR /app

# Install deps
COPY package.json package-lock.json ./
RUN npm ci

# Copy sources and build the three services
COPY . .
RUN npx nx run-many -t build --projects=api,reverse-proxy,web --configuration=production


FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Bring runtime deps + build artifacts
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package.json ./package.json

# Data directory (bind mount in compose)
RUN mkdir -p /app/data

# Default command is overridden by docker-compose services
CMD ["node", "dist/reverse-proxy/main.js"]
