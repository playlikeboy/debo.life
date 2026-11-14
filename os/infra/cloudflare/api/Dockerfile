# Debo OS API for Cloudflare Containers.
# Build context: the REPO ROOT (the API imports TypeScript packages from ../packages).
#   docker build -f os/infra/cloudflare/api/Dockerfile -t debo-os-api .
# Cloudflare Containers runs linux/amd64 only.
FROM node:22.22.0-bookworm-slim AS build
WORKDIR /repo/os
RUN npm install -g pnpm@11.19.0
# Package manifests first, so the install layer is cached until a dependency changes.
COPY os/package.json os/pnpm-lock.yaml os/pnpm-workspace.yaml ./
COPY os/patches ./patches
COPY os/apps/mobile/package.json ./apps/mobile/package.json
COPY os/apps/worker/package.json os/apps/worker/package-lock.json ./apps/worker/
COPY packages /repo/packages
# The API (root project) and the workspace packages it imports: @debo/db, llm, memory, brain.
# The Expo app and the browser worker are not installed here.
RUN pnpm install --frozen-lockfile --filter "openfuse..."
COPY os/tsconfig.json os/tsconfig.build.json ./
COPY os/scripts ./scripts
COPY os/apps/server ./apps/server
COPY os/packages ./packages
# One self-contained file: dist/server.mjs. No node_modules are needed at run time.
RUN node scripts/bundle-server.mjs

FROM node:22.22.0-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8787 DATA_DIR=/app/data
COPY --from=build --chown=node:node /repo/os/dist/server.mjs ./server.mjs
RUN mkdir -p /app/data && chown node:node /app/data
USER node
EXPOSE 8787
CMD ["node", "server.mjs"]
