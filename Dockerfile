ARG OWOX_BASE_IMAGE=ghcr.io/owox/owox-data-marts@sha256:778786d9a9d1a77d7cd443255be9b70daeb0b83ca598d51c2c2ec9fc402ea0d8

# The source checkout is built and tested before release. Overlaying only the
# generated runtime artifacts keeps Coolify's source deployment below its
# hard-coded SSH timeout while applying the runtime security patches below.
FROM ${OWOX_BASE_IMAGE}

ARG revision=unknown
ARG version=local
LABEL org.opencontainers.image.revision="${revision}"
LABEL org.opencontainers.image.version="${version}"
LABEL org.opencontainers.image.source="https://github.com/vanhao1997/p2pdigital-data-marts"

# Keep MCP dependencies aligned with the generated backend and apply patched
# HTTP/gRPC dependencies to the pinned base image, including nested SDK copies.
# Nested installation keeps their dependencies local to each patched package.
# Install from an isolated manifest because the base image's package.json
# contains private workspace devDependencies that are not published to npm.
RUN mkdir -p /tmp/runtime-dependencies \
  && printf '{"private":true}\n' > /tmp/runtime-dependencies/package.json \
  && npm install --prefix /tmp/runtime-dependencies --install-strategy=nested --omit=dev --ignore-scripts --no-audit --no-fund --package-lock=false \
    @modelcontextprotocol/core@2.0.0 @modelcontextprotocol/node@2.0.0 @modelcontextprotocol/server@2.0.0 \
    axios@1.20.0 @grpc/grpc-js@1.14.5 \
  && RUNTIME_ROOT=/usr/local/lib/node_modules/owox RUNTIME_PATCHES=/tmp/runtime-dependencies/node_modules \
    node -e '\
      const fs = require("node:fs"); \
      const path = require("node:path"); \
      const versions = { axios: "1.20.0", "@grpc/grpc-js": "1.14.5" }; \
      const root = fs.realpathSync(process.env.RUNTIME_ROOT); \
      const source = fs.realpathSync(process.env.RUNTIME_PATCHES); \
      for (const name of ["@owox/ui", "@owox/eslint-config", "@owox/prettier-config", "@owox/typescript-config"]) { \
        const workspacePath = path.join(root, "node_modules", name); \
        const workspaceLink = fs.lstatSync(workspacePath, { throwIfNoEntry: false }); \
        if (workspaceLink?.isSymbolicLink() && !fs.existsSync(workspacePath)) { \
          fs.unlinkSync(workspacePath); \
          console.log("Removed dangling build workspace link: " + name); \
        } \
      } \
      function patchPackages(modules) { \
        if (!fs.existsSync(modules)) return; \
        for (const entry of fs.readdirSync(modules, { withFileTypes: true })) { \
          if (!entry.isDirectory()) continue; \
          const packagePath = path.join(modules, entry.name); \
          if (entry.name.startsWith("@")) { patchPackages(packagePath); continue; } \
          const manifest = path.join(packagePath, "package.json"); \
          if (!fs.existsSync(manifest)) continue; \
          const installed = JSON.parse(fs.readFileSync(manifest, "utf8")); \
          if (Object.hasOwn(versions, installed.name)) { \
            if (!installed.version.startsWith("1.")) throw new Error("Unexpected runtime major version: " + installed.name); \
            fs.cpSync(path.join(source, installed.name), packagePath, { recursive: true }); \
            const updated = JSON.parse(fs.readFileSync(manifest, "utf8")); \
            if (updated.version !== versions[installed.name]) throw new Error("Runtime patch version mismatch: " + installed.name); \
          } \
          patchPackages(path.join(packagePath, "node_modules")); \
        } \
      } \
      patchPackages(path.join(root, "node_modules")); \
      fs.cpSync(source, path.join(root, "node_modules"), { recursive: true }); \
      console.log("Patched runtime HTTP and gRPC dependencies");' \
  && rm -rf /tmp/runtime-dependencies

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
