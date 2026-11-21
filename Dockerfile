# syntax=docker/dockerfile:1

# 1) Compila o front (React + Vite) em dist/
FROM node:22-alpine AS front
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html vite.config.js ./
COPY public ./public
COPY src ./src
RUN npm run build

# 2) Instala só as dependências de produção da API (better-sqlite3 usa binário pronto; se não houver, compila)
FROM node:22-alpine AS api-deps
WORKDIR /app/backend
RUN apk add --no-cache python3 make g++
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev

# 3) Imagem final: pequena, sem ferramentas de build, rodando como usuário comum
FROM node:22-alpine
ENV NODE_ENV=production \
    PORT=4747 \
    DB_PATH=/data/financeiro.db \
    BACKUP_DIR=/data/backups \
    STATIC_DIR=/app/dist
WORKDIR /app
COPY --from=api-deps /app/backend/node_modules ./backend/node_modules
COPY backend ./backend
COPY --from=front /app/dist ./dist
RUN mkdir -p /data && chown -R node:node /data
USER node
VOLUME /data
EXPOSE 4747
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:${PORT}/api/health || exit 1
CMD ["node", "backend/server.js"]
