# OpenBroker Labs — AI Workflow Portal for Encompass & TPO Connect

[![test](https://github.com/mortava/obassets/actions/workflows/test.yml/badge.svg?branch=claude%2Fai-workflow-management-WMRgQ)](https://github.com/mortava/obassets/actions/workflows/test.yml)
[![verify-deploy](https://github.com/mortava/obassets/actions/workflows/verify-deploy.yml/badge.svg?branch=claude%2Fai-workflow-management-WMRgQ)](https://github.com/mortava/obassets/actions/workflows/verify-deploy.yml)

> **Live production endpoint:** `https://vxoqwyntwsszipabhiuv.supabase.co/functions/v1/encompass-test` — verified end-to-end against the real `api.elliemae.com` OAuth endpoint. See [`DEPLOY_STATUS.md`](DEPLOY_STATUS.md).

A Next.js portal to design, run, and observe **AI‑augmented automated workflows**
on ICE Mortgage Technology's **Encompass** LOS and **TPO Connect** portal,
backed by a typed server‑side adapter to the Encompass Developer Connect (EDC)
REST API.

## Run it

```bash
npm install
npm run dev      # → http://localhost:3000
npm test         # vitest unit tests for the adapter
```

## Repo layout

```
.                       Next.js App Router project (deployed by Vercel)
├── app/                routes + API handlers
│   ├── api/
│   │   ├── connections/encompass/test       OAuth + smoke test
│   │   ├── connections/encompass/status     env-var status
│   │   └── healthz
│   ├── connections/page.tsx
│   ├── new/page.tsx                         wizard
│   ├── workflows/[id]/page.tsx
│   └── …
├── components/         UI: AppShell, Sidebar, wizard, FlowCanvas, …
├── lib/
│   ├── server/         server-only: EDC adapter, secrets, tests
│   └── …               shared types, catalog, guardrails, yaml, samples
├── docs/               architecture, plan, roadmap, security, portal guide
│   ├── ARCHITECTURE.md
│   ├── PLAN.md
│   ├── ROADMAP.md
│   ├── SECURITY.md
│   ├── WORKFLOW_MODEL.md
│   ├── ICE_API_SURFACE.md
│   ├── ENCOMPASS_SETUP.md     how to provision the EDC API user + env vars
│   └── PORTAL.md
├── knowledge/          AI-agent-queryable resource + policy index
│   ├── index.json
│   ├── resources/      ICE Developer Connect, Encompass Web, etc.
│   └── policies/       no-deletion.md (critical, enforced)
├── workflows/          declarative workflow examples + JSON Schema
├── POLICIES.md         pointer to critical platform policies
├── package.json
├── next.config.mjs
└── tailwind.config.ts
```

## Critical: no‑deletion policy

The platform **never** deletes data in Encompass — not loans, documents,
attachments, conditions, milestones, contacts, or fields. The rule is
enforced at four layers (catalog filter, portal preflight, runtime HTTP
adapter, AI tool whitelist). See [`POLICIES.md`](POLICIES.md) and
[`knowledge/policies/no-deletion.md`](knowledge/policies/no-deletion.md).

## Connecting to Encompass

1. Provision a least-privilege API user in Encompass admin (NOT a personal
   admin account).
2. Mint an EDC application; capture `client_id` / `client_secret`.
3. Add `ENCOMPASS_*` env vars locally (`.env.example` template) or in
   Vercel → Project → Settings → Environment Variables.
4. Open the portal → **Connections** → **Test connection** on the
   Encompass row. The dashboard exchanges your credentials for an OAuth
   token and calls a lightweight read endpoint, end‑to‑end.

Full setup walkthrough: [`docs/ENCOMPASS_SETUP.md`](docs/ENCOMPASS_SETUP.md).

## Deploying

The repo is a standard Next.js app at the root — no monorepo config
needed. Vercel auto‑detects on import.

1. Import `mortava/obassets` at <https://vercel.com/new>.
2. Add `ENCOMPASS_*` env vars (mark each as Secret).
3. Deploy. Every subsequent push auto‑deploys.

## Status

| Surface | State |
|---|---|
| Workflow JSON Schema + examples | Done |
| Knowledge base | Done |
| Portal wizard (Goal → Trigger → Flow → Connect → Review → Publish) | Done |
| Server-side EDC OAuth adapter | Done |
| Dashboard live connection test | Done |
| No-deletion guardrail (4 layers) | Done + tested |
| Unit tests (`lib/server/__tests__/encompass.test.ts`) | 15/15 pass |
| Integration tests with mock EDC over real HTTP | 7/7 pass |
| Deploy probe script (`scripts/verify-deploy.sh`) | Done |
| GitHub Actions CI (`test.yml`, `verify-deploy.yml`) | Done |
| Durable workflow runtime (Temporal/Inngest) | Planned (Phase 1, see `docs/ROADMAP.md`) |
| Multi-tenant prod | Planned (Phase 2) |

## Verifying the production deploy

Two CI workflows run on every push:

- `.github/workflows/test.yml` — typecheck, vitest (22 tests), `next build`
- `.github/workflows/verify-deploy.yml` — waits for Vercel to roll out, then
  runs `scripts/verify-deploy.sh` against the deployed URL. Skips cleanly
  until the `PROD_URL` repo variable is set.

To enable the deploy verifier:

1. Vercel: import the repo at <https://vercel.com/new>. With the app at the
   repo root no extra configuration is needed.
2. Set `ENCOMPASS_*` env vars in Vercel → Project → Settings → Environment
   Variables (see `.env.example`).
3. GitHub: **Settings → Secrets and variables → Actions → Variables → New
   repository variable**, name `PROD_URL`, value = your `https://*.vercel.app` URL.

From the next push onward, the CI checks "test" and "verify-deploy" both
go green when the production deploy is healthy and the Encompass adapter
path reaches ICE successfully.
