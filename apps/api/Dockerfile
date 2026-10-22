# API image. Build from the repo root: docker build -f apps/api/Dockerfile .
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production

# Install only the API's production dependencies (npm workspaces share one lockfile)
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --omit=dev --workspace apps/api --include-workspace-root=false && npm cache clean --force

COPY apps/api/src apps/api/src
WORKDIR /app/apps/api
USER node
EXPOSE 4100
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=5 \
  CMD wget -qO- http://127.0.0.1:4100/api/health || exit 1
CMD ["node", "src/server.js"]
