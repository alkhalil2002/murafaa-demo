# Deploying Murafaa on Railway

The lower-effort alternative to the GCP runbook in `DEPLOYMENT.md`. Use this to
get a pilot live quickly. Read **§5 (residency)** before putting a real law
office's case files on it — that is the one thing this path does not satisfy.

---

## 1. Why Railway and not Vercel

Vercel is the obvious guess for a Next.js app, and it is the wrong host for
this one. Three specific reasons, all pre-existing properties of the codebase:

| Requirement | Where it comes from | Vercel | Railway |
|---|---|---|---|
| **Chromium at runtime** | `puppeteer` renders every invoice / case PDF. The Dockerfile installs Debian `chromium` + `fonts-noto-core`, and the Arabic font is what stops PDFs rendering as boxes. | Serverless functions have no Chromium. Needs `@sparticuz/chromium` and a rewrite of the PDF path, still fighting the bundle-size cap. | Runs the existing Dockerfile unchanged. |
| **A long-lived server process** | `output: "standalone"`, `scripts/assemble-standalone.mjs`, `src/instrumentation.ts` boot guard. | The startup guard is per-invocation, not per-deploy; a bad config gets caught on a user's request rather than at deploy time. | `node server.js` runs exactly as it does locally and in the GCP image. |
| **Durable document storage** | `src/lib/storage` writes uploaded files. | No writable persistent disk. Requires a bucket regardless. | Persistent volume, or a bucket. |

Railway builds the `Dockerfile` that is already in the repo and already
verified. Nothing about the app changes.

**Fly.io or Render** work the same way for the same reasons — anything that
runs a container with a volume. Substitute freely; only the CLI differs.

---

## 2. Services to create

Three, in one Railway project:

1. **Postgres** — Railway's Postgres plugin. Exposes `DATABASE_URL`.
2. **App** — deployed from this repo; Railway auto-detects the `Dockerfile`.
3. **Volume** — attached to the App service, mounted at `/data`.

`pgvector` is **not** required yet. The knowledge-base embedder is an offline
hash stub and similarity runs in the app layer (`prisma/schema.prisma`, the
`KnowledgePassage` comments). Phase 5 needs the extension; when it does, use
the `pgvector/pgvector` image instead of the stock Postgres plugin.

---

## 3. Environment variables

Set these on the **App** service. Railway injects `PORT` itself — do not set it.

```
NODE_ENV=production
DATABASE_URL=${{Postgres.DATABASE_URL}}     # Railway reference, not a literal
AUTH_SECRET=<openssl rand -base64 32>

STORAGE_DRIVER=volume
STORAGE_LOCAL_DIR=/data                      # must equal the volume mount path

OTP_PROVIDER=whatsapp
WHATSAPP_OTP_URL=https://camp-app.siyaq.io/outbound/webhook/<id>
WHATSAPP_OTP_TOKEN=<bearer token>
```

`AUTH_SECRET` and `WHATSAPP_OTP_TOKEN` are live credentials. They belong in
Railway's variable store and nowhere else — not in `.env`, not in a commit, not
in client code.

The app **refuses to boot** if any of these is missing or unsafe
(`src/lib/config/env.ts`). That is deliberate: a container that would silently
discard uploaded documents must never accept a request. If a deploy dies at
startup, read the log — it names the exact variable.

---

## 4. Deploy

```bash
railway login
railway link                       # select the project
railway up                         # builds the Dockerfile, deploys

# migrations do NOT run at startup, by design — run them explicitly
railway run npx prisma migrate deploy

# first office + platform admin
railway run npm run db:seed
railway run npm run db:seed:platform
```

Then check `https://<service>.up.railway.app/api/health`.

### Verifying WhatsApp delivery

Trigger a real send and watch the response — this delivers an actual message,
so use your own number:

```bash
curl -X POST https://<service>.up.railway.app/api/auth/otp \
  -H 'Content-Type: application/json' \
  -d '{"phone":"05XXXXXXXX","channel":"whatsapp"}'
```

- `200 {"data":{"sent":true}}` — delivered.
- `502 auth.otp.deliveryFailed` — the webhook rejected it. The server log has
  the vendor's status and response body; the code is never logged.
- `404 auth.error.userNotFound` — the number has no user. Seed one first.

---

## 5. Residency — the limit of this path

`CLAUDE.md` requires all data to stay in-Kingdom for PDPL, which is why the
GCP runbook targets Dammam (`me-central2`).

**Railway has no Saudi region, and neither does Vercel.** A pilot on Railway
stores Saudi legal case files outside the Kingdom. That is fine for:

- internal demos and sales pitches with synthetic data,
- your own testing,
- anything where the data is not a real client's.

It is **not** fine once a real law office uploads a real case file. Before that
happens, either move to `me-central2` (`DEPLOYMENT.md`) or set
`STORAGE_DRIVER=gcs` with a Dammam bucket so at least the documents are
in-Kingdom while the compute moves.

Nothing in the app has to change for that migration — storage is an adapter and
the AI router already refuses to send case-bearing prompts to an out-of-Kingdom
provider (`src/lib/ai/providers.ts`). The move is configuration plus a database
dump/restore.

---

## 6. Known limits of the volume driver

- **One replica.** A Railway volume attaches to a single instance. Scaling
  horizontally requires switching `STORAGE_DRIVER` to `gcs` (or an
  S3-compatible driver, not yet written). Startup warns about this every boot.
- **Backups are yours.** A bucket has versioning and lifecycle rules; a volume
  has neither. Schedule a `pg_dump` and a volume snapshot.
- **Postgres and documents fail independently.** A database restore without the
  matching volume leaves `Document` rows whose bytes are gone. Snapshot both
  together.
