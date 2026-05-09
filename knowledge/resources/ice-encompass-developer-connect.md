---
id: ice-encompass-developer-connect
title: Encompass Developer Connect — Welcome / Documentation Hub
url: https://developer.icemortgagetechnology.com/developer-connect/docs/welcome
publisher: ICE Mortgage Technology
category: developer-docs
trust: official
tags:
  - encompass
  - edc
  - rest-api
  - oauth
  - webhooks
  - loan-data
  - pipeline
  - documents
  - milestones
  - conditions
  - send-docs
  - tpo-connect
  - sandbox
  - production
addedAt: 2026-05-09
lastValidated: 2026-05-09
status: active
relatedEntries:
  - ice-encompass-product-overview
  - policy-no-deletion
---

# Encompass Developer Connect

The primary developer portal for the Encompass Loan Origination System (LOS)
and adjacent ICE Mortgage Technology surfaces. This is where the platform
authenticates, subscribes to events, and reads/writes loan data.

## Why this matters to the platform

Every workflow run touches Encompass through this surface. Triggers,
side‑effecting steps, document fetches, condition lifecycle, milestone
advancement, disclosure delivery — all routed through endpoints documented
here.

## What lives there (relevant to us)

- **REST API reference** for loans, pipeline, contacts, documents, milestones,
  conditions, services. The platform's `edc.*` tools are thin typed wrappers
  over these endpoints.
- **Authentication** — OAuth 2.0 with client_credentials and authorization_code
  flows. Per‑integration `client_id` / `client_secret` provisioned in the
  Encompass admin console. Tokens are short‑lived and must be cached + refreshed.
- **Webhooks** — subscription model is `(resource, events, endpoint)` with
  signature verification on delivery. Delivery is **at‑least‑once** and not
  guaranteed in order — reconciliation against pipeline `lastModified` is
  required.
- **Send Encompass Docs** — opening (3‑day), closing, and on‑demand document
  flows targeting Consumer Connect (borrower) and Loan Connect (3rd party).
- **API key issuance** — only an Encompass user with super administrator
  persona can mint API keys. Runtime workflows must use a least‑privilege API
  user, not a super‑admin account.
- **Sandbox vs production** — different hosts and different credential sets.
  The platform models environment as first‑class.

## Critical reads (cross‑references)

- Authentication / Authorization
- Webhook subscriptions and best practices
- Send Encompass Docs guides (Opening / Closing / On‑Demand)
- SDK to API migration guide (the legacy SDK path is deprecated)
- API rate limits and throttling

## Constraints the platform enforces

- All EDC traffic flows through the typed adapter — workflows never speak raw
  HTTP.
- DELETE‑style endpoints are **forbidden** by the platform's no‑deletion
  policy. See [`policy-no-deletion`](../policies/no-deletion.md).
- Every side‑effecting call carries an idempotency key derived from
  `(runId, stepId, attempt)`.
