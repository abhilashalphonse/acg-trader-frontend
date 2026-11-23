FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --include=dev
COPY . .
ARG VITE_ACG_TRADER_API_BASE
ARG VITE_ACG_TRADER_WS_URL
ARG VITE_ACG_TRADER_HTTP_TIMEOUT_MS
ARG VITE_ACG_TRADER_TENANT
ARG VITE_ACG_FUNDED_URL
ARG VITE_ACG_SUPABASE_AUTH_ENABLED
# The approved V4 desktop workspace was compiled into Firebase preview builds.
# Railway must explicitly compile the same V4 presentation instead of silently
# falling back to the legacy desktop. A build-time override remains possible.
ARG VITE_ACG_EXECUTION_V4_ENABLED=true
# Release-approved compact positions dock + detachable mini popup are live by
# default. Railway can set this build arg to false for rapid rollback.
ARG VITE_ACG_DOCK_LIVE_ENABLED=true
# Publish mock design review only when explicitly enabled by an isolated preview.
ARG VITE_ACG_PUBLIC_DOCK_PREVIEW=false
RUN npm run build && node scripts/prepare-landing-films.mjs

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/dist ./dist
COPY server.mjs ./server.mjs
USER node
EXPOSE 3000
CMD ["node", "server.mjs"]
