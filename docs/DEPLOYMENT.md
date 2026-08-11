---
title: Deployment runbook
tags: [ops, deployment, cloud-run]
created: 2026-08-11
status: draft
---

# Deployment — Cloud Run (me-central2 / Dammam)

Everything here targets **`me-central2`**. That is not a preference: case files
are personal data under PDPL, and the data must stay in-Kingdom. Do not fall
back to another region because a service "isn't available yet" — raise it
instead. See [[02-technical-spec]] §7.

> **This runbook gets you a working staging deployment. It does NOT make the
> product sellable.** The blockers for that are listed at the bottom.

---

## 0. What is already done

The repository is deployable: `output: "standalone"`, a multi-stage
`Dockerfile`, `.dockerignore`, and an unauthenticated `/api/health` probe that
round-trips the database (so a container that cannot reach Cloud SQL reports
503 rather than taking traffic and failing every request).

The standalone server has been verified locally — `/api/health` → `{"status":
"ok"}`, `/login` → 200.

## 1. Prerequisites

```sh
gcloud config set project <PROJECT_ID>
gcloud services enable \
  run.googleapis.com sqladmin.googleapis.com secretmanager.googleapis.com \
  artifactregistry.googleapis.com cloudbuild.googleapis.com

gcloud artifacts repositories create murafaa \
  --repository-format=docker --location=me-central2
```

## 2. Database — Cloud SQL for PostgreSQL

```sh
gcloud sql instances create murafaa-db \
  --database-version=POSTGRES_16 --region=me-central2 \
  --tier=db-custom-2-7680 --storage-auto-increase \
  --backup --backup-start-time=22:00
gcloud sql databases create murafaa --instance=murafaa-db
gcloud sql users create murafaa_app --instance=murafaa-db --password=<STRONG>
```

`pgvector` is needed for the AI knowledge base (Phase 5). Enable it once, as a
superuser, against the created database:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

> **Backups are not optional.** These are law firms' case files. Verify a
> restore actually works before the first real tenant — an untested backup is
> not a backup.

## 3. Storage — GCS bucket

```sh
gcloud storage buckets create gs://murafaa-docs \
  --location=me-central2 --uniform-bucket-level-access
```

> ⚠️ **This is the single most dangerous misconfiguration in the system.**
> `STORAGE_DRIVER` defaults to `local`, and Cloud Run's filesystem is
> **ephemeral**. If the service starts without `STORAGE_DRIVER=gcs` and a valid
> `GCS_BUCKET`, every uploaded document is written to a disk that disappears on
> the next restart or scale-down — silently, with no error. Set both before any
> real file is uploaded.

## 4. Secrets

Never in env vars on the service, never in the image, never in `.env`:

```sh
for s in auth-secret database-url gcs-bucket unifonic-app-sid unifonic-sender-id; do
  gcloud secrets create "$s" --replication-policy=user-managed --locations=me-central2
done
printf '%s' "$(openssl rand -base64 32)" | gcloud secrets versions add auth-secret --data-file=-
```

## 5. Build and push

```sh
gcloud builds submit \
  --tag me-central2-docker.pkg.dev/<PROJECT_ID>/murafaa/app:<GIT_SHA>
```

Tag with the git SHA, not `latest` — you need to know exactly which commit is
serving, and to roll back to a specific one.

## 6. Migrations — a SEPARATE step, before traffic

Migrations are deliberately **not** run on container start. Cloud Run starts
many instances concurrently and they would race each other applying the same
migration.

```sh
gcloud run jobs create murafaa-migrate \
  --image me-central2-docker.pkg.dev/<PROJECT_ID>/murafaa/app:<GIT_SHA> \
  --region me-central2 \
  --set-secrets DATABASE_URL=database-url:latest \
  --command npx --args "prisma,migrate,deploy"

gcloud run jobs execute murafaa-migrate --region me-central2 --wait
```

Run this **before** deploying the revision that depends on the new schema.

## 7. Deploy the service

```sh
gcloud run deploy murafaa \
  --image me-central2-docker.pkg.dev/<PROJECT_ID>/murafaa/app:<GIT_SHA> \
  --region me-central2 \
  --add-cloudsql-instances <PROJECT_ID>:me-central2:murafaa-db \
  --set-secrets DATABASE_URL=database-url:latest,AUTH_SECRET=auth-secret:latest,GCS_BUCKET=gcs-bucket:latest \
  --set-env-vars STORAGE_DRIVER=gcs,OTP_PROVIDER=unifonic,NODE_ENV=production \
  --service-account murafaa-run@<PROJECT_ID>.iam.gserviceaccount.com \
  --cpu 2 --memory 2Gi --min-instances 1 --max-instances 10 \
  --allow-unauthenticated
```

Sizing notes, and why:

- **2 GiB / 2 vCPU** — Chromium renders the PDFs in-process. 512 MiB will OOM
  the moment someone exports one.
- **`--min-instances 1`** — a cold start pays Chromium and Prisma engine
  startup. Zero is fine for a demo, not for a firm mid-hearing.
- **Service account** needs `roles/cloudsql.client` and
  `roles/storage.objectAdmin` on the bucket only — not project-wide.

### Required environment

| Variable | Value | If it is wrong |
|---|---|---|
| `DATABASE_URL` | Cloud SQL socket URL | Health check 503s; nothing serves |
| `AUTH_SECRET` | 32-byte random | Sessions and OTP hashes are forgeable |
| `STORAGE_DRIVER` | `gcs` | **Documents are silently lost** |
| `GCS_BUCKET` | `murafaa-docs` | Startup throws `STORAGE_MISCONFIGURED` |
| `OTP_PROVIDER` | `unifonic` | Codes go to the log; **nobody can log in** |
| `AI_DRAFT_MODEL` | optional | Defaults to `claude-haiku-4-5` |

## 8. After deploying

```sh
curl -fsS https://<URL>/api/health          # {"status":"ok"}
curl -s -o /dev/null -w '%{http_code}\n' https://<URL>/login   # 200
```

Then seed the platform side once (plans + operator logins):

```sh
gcloud run jobs create murafaa-seed-platform \
  --image <IMAGE> --region me-central2 \
  --set-secrets DATABASE_URL=database-url:latest \
  --command npx --args "tsx,scripts/seed-platform.ts"
```

Do **not** run `prisma/seed.ts` against production — that seeds a demo tenant.

## 9. Still required before selling

Deploying does not make this sellable. Outstanding:

1. **Payment gateway** — the adapter declines every charge by design, so no
   subscription can become `ACTIVE`.
2. **Real AI** — `StubLlm` / `StubEmbedder` are offline stubs. The citation gate
   is real; the model behind it is not.
3. **ZATCA Phase 2 e-invoicing** — invoices carry 15% VAT but no QR, hash, XML,
   or clearance. Deferred in [[02-technical-spec]] §7; a legal exposure for
   VAT-registered customers.
4. **Security review** — no pen test, no dependency audit, rate limiting only on
   OTP resend.
5. **Business-rule audit** — the test suite covers the rules that have tests;
   nobody has walked [[06-business-rules]] line by line against the code.
6. **Terms of service, privacy policy, DPA** — required before processing a real
   firm's data.
7. **Restore drill** — prove a backup restores before a customer needs it to.
