ARG OWOX_BASE_IMAGE=ghcr.io/owox/owox-data-marts@sha256:778786d9a9d1a77d7cd443255be9b70daeb0b83ca598d51c2c2ec9fc402ea0d8

# The source checkout is built and tested before release. Overlaying only the
# generated runtime artifacts keeps Coolify's source deployment below its
# hard-coded SSH timeout while retaining the official runtime dependencies.
FROM ${OWOX_BASE_IMAGE}

ARG revision=unknown
ARG version=local
LABEL org.opencontainers.image.revision="${revision}"
LABEL org.opencontainers.image.version="${version}"
LABEL org.opencontainers.image.source="https://github.com/vanhao1997/p2pdigital-data-marts"

# The immutable overlay may contain backend code newer than the pinned OWOX
# base image. Keep runtime-only MCP dependencies aligned with that code so the
# application can load the backend module before the health endpoint starts.
# Install from an isolated manifest because the base image's package.json
# contains private workspace devDependencies that are not published to npm.
RUN mkdir -p /tmp/mcp-runtime \
  && printf '{"private":true}\n' > /tmp/mcp-runtime/package.json \
  && npm install --prefix /tmp/mcp-runtime --omit=dev --ignore-scripts --no-audit --no-fund --package-lock=false @modelcontextprotocol/server@2.0.0 \
  && cp -a /tmp/mcp-runtime/node_modules/. /usr/local/lib/node_modules/owox/node_modules/ \
  && rm -rf /tmp/mcp-runtime

COPY deploy/owox-runtime-artifacts.tar.gz /tmp/owox-runtime-artifacts.tar.gz
RUN tar -xzf /tmp/owox-runtime-artifacts.tar.gz -C /tmp \
  && cp -a /tmp/packages/connectors/dist/. /usr/local/lib/node_modules/owox/node_modules/@owox/connectors/dist/ \
  && cp -a /tmp/packages/idp-protocol/dist/. /usr/local/lib/node_modules/owox/node_modules/@owox/idp-protocol/dist/ \
  && cp -a /tmp/packages/idp-owox-better-auth/dist/. /usr/local/lib/node_modules/owox/node_modules/@owox/idp-owox-better-auth/dist/ \
  && cp -a /tmp/packages/idp-better-auth/dist/. /usr/local/lib/node_modules/owox/node_modules/@owox/idp-better-auth/dist/ \
  && cp -a /tmp/apps/backend/dist/. /usr/local/lib/node_modules/owox/node_modules/@owox/backend/dist/ \
  && cp -a /tmp/apps/web/dist/. /usr/local/lib/node_modules/owox/node_modules/@owox/web/dist/ \
  && cp -a /tmp/apps/owox/dist/. /usr/local/lib/node_modules/owox/dist/ \
  && rm -rf /tmp/packages /tmp/apps /tmp/owox-runtime-artifacts.tar.gz

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD node -e "const port=process.env.PORT||3000;fetch('http://127.0.0.1:'+port+'/health/ready').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
