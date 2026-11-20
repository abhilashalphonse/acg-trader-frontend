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
RUN npm run build

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/dist ./dist
COPY server.mjs ./server.mjs
USER node
EXPOSE 3000
CMD ["node", "server.mjs"]
