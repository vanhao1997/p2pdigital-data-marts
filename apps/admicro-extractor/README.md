# Admicro Extractor

Private Playwright sidecar for the `AdmicroAds` connector. It exposes `GET /healthz`,
`POST /v1/preview`, and signed `POST /v1/extract` only. Requests use timestamp, nonce, body
SHA-256, and HMAC-SHA-256 headers. The service does not persist passwords, cookies, or raw
`DATAVIEW` payloads.

Run locally with:

```bash
ADMICRO_EXTRACTOR_SHARED_SECRET=replace-me npm start
```

Keep the service on a private network and inject the shared secret from Secret Manager.
`ADMICRO_EXTRACTOR_MAX_CONCURRENCY` defaults to `2` browser jobs.
`ADMICRO_EXTRACTOR_NONCE_STORE=memory` keeps replay nonces in process memory for one replica.
Set `ADMICRO_EXTRACTOR_NONCE_STORE=redis` and provide `ADMICRO_EXTRACTOR_REDIS_URL` before
scaling horizontally. Redis uses an atomic `SET NX PX` claim; the extractor fails closed if
the replay store is unavailable.

For local self-hosting from the repository root:

```bash
ADMICRO_EXTRACTOR_SHARED_SECRET=replace-me docker compose -f docker-compose.admicro.yml --profile admicro up -d
```

The Compose port binds to `127.0.0.1:8091`; it is not exposed on public interfaces.

For a local shared replay store, use the `admicro-redis` profile and set
`ADMICRO_EXTRACTOR_NONCE_STORE=redis`:

```bash
ADMICRO_EXTRACTOR_SHARED_SECRET=replace-me \
ADMICRO_EXTRACTOR_NONCE_STORE=redis \
docker compose -f docker-compose.admicro.yml --profile admicro --profile admicro-redis up -d
```
