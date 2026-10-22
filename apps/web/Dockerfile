# Web image. Build from the repo root: docker build -f apps/web/Dockerfile .
# API_URL is baked in at build time (Next.js rewrites), so pass it as a build arg.
FROM node:22-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --workspace apps/web --include-workspace-root=false
COPY apps/web apps/web
ARG API_URL=http://api:4100
ENV API_URL=$API_URL
RUN npm run build --workspace apps/web

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
ARG API_URL=http://api:4100
ENV API_URL=$API_URL
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/apps/web ./apps/web
WORKDIR /app/apps/web
USER node
EXPOSE 3100
CMD ["node", "../../node_modules/next/dist/bin/next", "start", "-p", "3100"]
