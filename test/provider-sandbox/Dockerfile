FROM node:22-alpine

WORKDIR /app
COPY test/provider-sandbox/*.mjs /app/test/provider-sandbox/
ENV NODE_ENV=production
ENV PORT=8099
EXPOSE 8099
HEALTHCHECK --interval=10s --timeout=3s --retries=5 CMD node -e "fetch('http://127.0.0.1:8099/healthz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "test/provider-sandbox/server.mjs"]
