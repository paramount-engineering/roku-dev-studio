# syntax=docker/dockerfile:1@sha256:ecfaec9ed6d810b56388c508f4121597bfbba70d41a6dfeee4d8cad5f295fc32

# ─── Build stage ─────────────────────────────────────────────────────────────
# Builds only the three workspace packages the MCP server needs, in dependency
# order (platform → api → mcp). Deliberately skips apps/* (Electron/Monaco),
# which the MCP server does not use — keeps the build small and reliable.
FROM node:22-bookworm-slim@sha256:4b150b48b4116e2a22f2c39cc27025fbf4f153e2078fd3b14d159fdb5c7279da AS build
WORKDIR /app

# CI=true turns each package's `prepare` script into a no-op, so `npm install`
# never triggers an out-of-order build. We build explicitly, in order, below.
ENV CI=true

# Minimal workspace root — only packages/*, never apps/*.
RUN printf '{"name":"rds-mcp-build","private":true,"workspaces":["packages/*"]}\n' > package.json

# Each package's tsconfig extends ../../tsconfig.base.json.
COPY tsconfig.base.json ./

# Only the three packages in the dependency graph.
COPY packages/roku-dev-studio-platform/ packages/roku-dev-studio-platform/
COPY packages/roku-dev-studio-api/       packages/roku-dev-studio-api/
COPY packages/roku-dev-studio-mcp/       packages/roku-dev-studio-mcp/

# Installs deps for all three workspaces; inter-workspace deps link locally.
RUN npm install

# esbuild bundles api + platform (and the prose .md files) into a single,
# self-contained dist/index.cjs for the MCP server.
RUN npm run build --workspace roku-dev-studio-platform \
 && npm run build --workspace roku-dev-studio-api \
 && npm run build --workspace roku-dev-studio-mcp

# ─── Runtime stage ───────────────────────────────────────────────────────────
# The bundle inlines every dependency, so the runtime image needs nothing but
# Node and the single .cjs file.
FROM node:22-bookworm-slim@sha256:4b150b48b4116e2a22f2c39cc27025fbf4f153e2078fd3b14d159fdb5c7279da AS runtime
WORKDIR /app
COPY --from=build /app/packages/roku-dev-studio-mcp/dist/index.cjs ./index.cjs

# Speaks MCP (JSON-RPC 2.0) over stdio. Glama's introspection driver connects
# here; initialize / tools|resources|prompts.list are answered with no Roku
# device, desktop app, or bridge socket present.
ENTRYPOINT ["node", "/app/index.cjs"]
