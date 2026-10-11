ARG NODE_IMAGE=node:22.22.3-bookworm-slim@sha256:e21fc383b50d5347dc7a9f1cae45b8f4e2f0d39f7ade28e4eef7d2934522b752

# CI builds and validates JavaScript before staging output/runtime-context.
# Install a fresh Linux production tree from its unchanged npm lockfile; never
# reuse dependencies or native binaries from a published OWOX image/build host.
FROM ${NODE_IMAGE} AS runtime-dependencies
WORKDIR /usr/local/lib/node_modules/owox

# Keep native install scripts enabled. SQLite and other native packages can fall
# back to node-gyp when a prebuilt binary is unavailable for the target platform.
# Build tools stay in this stage and are not shipped in the final image.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/* \
  && npm install --global npm@10.9.8 --ignore-scripts --no-audit --no-fund

COPY . .
# Only root development hooks are inapplicable to the staged context. Disabling
# npm lifecycle scripts globally would skip required native dependency builds.
RUN node -e 'const fs=require("node:fs");const file="package.json";const manifest=JSON.parse(fs.readFileSync(file,"utf8"));delete manifest.scripts.prepare;delete manifest.scripts.postinstall;fs.writeFileSync(file,JSON.stringify(manifest));' \
  && npm ci --omit=dev --no-audit --no-fund \
  && npm cache clean --force

FROM ${NODE_IMAGE} AS runtime

ARG revision=unknown
ARG version=local
LABEL org.opencontainers.image.revision="${revision}"
LABEL org.opencontainers.image.version="${version}"
LABEL org.opencontainers.image.source="https://github.com/vanhao1997/p2pdigital-data-marts"

ENV NODE_ENV=production
ENV NODE_OPTIONS=--no-deprecation
# Preserve the upstream image's root user and working directory so env-paths,
# existing data volumes and relative SQLITE_DB_PATH values retain their paths.
WORKDIR /

COPY --from=runtime-dependencies /usr/local/lib/node_modules/owox /usr/local/lib/node_modules/owox
# Restore the original root manifest after suppressing its build-only hooks.
COPY package.json /usr/local/lib/node_modules/owox/package.json
COPY deploy/healthchecks/http-healthcheck.cjs /usr/local/bin/owox-http-healthcheck.cjs
RUN chmod +x /usr/local/lib/node_modules/owox/apps/owox/bin/run.js \
  && ln -s /usr/local/lib/node_modules/owox/apps/owox/bin/run.js /usr/local/bin/owox \
  && chmod +x /usr/local/bin/owox-http-healthcheck.cjs

ENTRYPOINT ["owox"]
CMD ["serve"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD node /usr/local/bin/owox-http-healthcheck.cjs /health/ready 3000
