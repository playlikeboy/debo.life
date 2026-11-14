# Debo OS API for Cloudflare Containers. Build context: the os/ directory.
#   docker build -f infra/cloudflare/api/Dockerfile -t debo-os-api .
# Cloudflare Containers runs linux/amd64 only.
FROM node:22.22.0-bookworm-slim AS build
WORKDIR /app
RUN npm install -g pnpm@11.19.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY patches ./patches
COPY apps/mobile/package.json ./apps/mobile/package.json
COPY apps/worker/package.json apps/worker/package-lock.json ./apps/worker/
# Only the root (server) dependencies; the Expo app and browser worker are not needed here.
RUN pnpm install --frozen-lockfile --filter .
COPY tsconfig.json tsconfig.build.json ./
COPY apps/server ./apps/server
COPY packages ./packages
RUN pnpm build:server
RUN CI=true pnpm prune --prod

FROM node:22.22.0-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8787 DATA_DIR=/app/data
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json ./
RUN mkdir -p /app/data && chown node:node /app/data
USER node
EXPOSE 8787
CMD ["node", "dist/apps/server/src/index.js"]
