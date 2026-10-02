# syntax=docker/dockerfile:1.7
# Jeden Dockerfile pro celé monorepo: cíle "web", "worker" a "migrate".

FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH NEXT_TELEMETRY_DISABLED=1 CI=1
RUN corepack enable
WORKDIR /repo

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY apps/web/package.json apps/web/
COPY apps/worker/package.json apps/worker/
COPY packages/cz/package.json packages/cz/
COPY packages/db/package.json packages/db/
COPY packages/fiscal-core/package.json packages/fiscal-core/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
# NEXT_PUBLIC_* se vkládá do JS při buildu
ARG NEXT_PUBLIC_SITE_URL=https://evidujzdarma.cz
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
RUN pnpm --filter @ez/web build

# ---------- web: Next.js standalone server ----------
FROM node:22-bookworm-slim AS web
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
WORKDIR /app
RUN groupadd -r app && useradd -r -g app -u 1001 app
COPY --from=build --chown=app:app /repo/apps/web/.next/standalone ./
COPY --from=build --chown=app:app /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=app:app /repo/apps/web/public ./apps/web/public
USER app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/web/server.js"]

# ---------- worker: plánované úlohy + import katalogu ----------
FROM deps AS worker
COPY . .
ENV NODE_ENV=production
WORKDIR /repo/apps/worker
USER node
CMD ["node", "--import", "tsx", "src/index.ts"]

# ---------- migrate: jednorázové migrace DB ----------
FROM deps AS migrate
COPY packages/db packages/db
WORKDIR /repo/packages/db
CMD ["node", "--import", "tsx", "src/migrate.ts"]
