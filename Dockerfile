# ── Build stage ───────────────────────────────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev

# ── Runtime stage ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime
WORKDIR /app

# Copy only what we need
COPY --from=build /app/node_modules ./node_modules
COPY package.json ./
COPY server.js    ./
COPY public/      ./public/

# Non-root user for security
RUN addgroup -S apollo && adduser -S apollo -G apollo
RUN mkdir -p /app/data && chown -R apollo:apollo /app/data
USER apollo

ENV NODE_ENV=production PORT=3000
EXPOSE ${PORT}

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:${PORT}/health || exit 1

CMD ["node", "server.js"]
