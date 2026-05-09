# Architecture

## 1. System diagram (logical)

```
                  ┌──────────────────────────────────────────────────┐
                  │  ICE Mortgage Technology Platform                 │
                  │  - Encompass LOS                                  │
                  │  - TPO Connect (broker portal)                    │
                  │  - Consumer Connect (borrower)                    │
                  │  - Loan Connect (settlement / 3rd party)          │
                  └──────────────────────────────────────────────────┘
                       │  webhooks (HTTPS POST)        ▲ REST (OAuth 2.0)
                       ▼                                │
        ┌────────────────────────────────────────────────────────────┐
        │  Workflow Platform (this repo, future code)                │
        │                                                            │
        │  ┌────────────┐  ┌──────────────┐  ┌────────────────────┐  │
        │  │ Webhook    │  │ Reconciler   │  │ Scheduler / Cron   │  │
        │  │ ingestor   │  │ (sweeps EDC) │  │ (timers, SLAs)     │  │
        │  └─────┬──────┘  └──────┬───────┘  └─────────┬──────────┘  │
        │        ▼                 ▼                    ▼            │
        │  ┌──────────────────────────────────────────────────────┐  │
        │  │           Event Bus (durable queue)                   │  │
        │  └──────────────────────────────────────────────────────┘  │
        │                          │                                  │
        │                          ▼                                  │
        │  ┌──────────────────────────────────────────────────────┐  │
        │  │  Workflow Engine (durable execution: Temporal-class)  │  │
        │  │   - run state, retries, signals, timers, replay       │  │
        │  └──────────────────────────────────────────────────────┘  │
        │     │           │              │                │           │
        │     ▼           ▼              ▼                ▼           │
        │  ┌──────┐   ┌────────┐    ┌────────┐      ┌──────────┐     │
        │  │ EDC  │   │ AI     │    │ Human  │      │ 3rd-party│     │
        │  │ tools│   │ tools  │    │ tasks  │      │ tools    │     │
        │  └──────┘   └────────┘    └────────┘      └──────────┘     │
        │                                                            │
        │  ┌──────────────────────────────────────────────────────┐  │
        │  │  State store (Postgres) — runs, audit, RBAC, configs │  │
        │  └──────────────────────────────────────────────────────┘  │
        │  ┌──────────────────────────────────────────────────────┐  │
        │  │  Console (Next.js): designer, run viewer, approvals  │  │
        │  └──────────────────────────────────────────────────────┘  │
        └────────────────────────────────────────────────────────────┘
```

## 2. Components

### 2.1 Webhook ingestor
- HTTPS endpoint per tenant: `POST /webhook/{tenantId}`.
- Verifies signature / shared secret per ICE webhook setup.
- Persists raw payload + headers (forensics) and enqueues onto the event bus.
- Idempotent on `(tenantId, eventId)` — drops duplicates from at‑least‑once
  delivery.
- Returns 200 fast (< 1s) so ICE does not retry on slow processing.

### 2.2 Reconciler
- Periodic sweeper that calls EDC pipeline / loan list endpoints to detect
  missed events (webhooks can be lost). Per ICE best‑practices guidance.
- Emits synthetic "missed‑event" entries onto the bus with an explicit source
  tag so workflows can dedupe.

### 2.3 Scheduler
- Drives time‑based triggers ("3 days after disclosure", "if no broker
  response in 24h") and SLA timers.
- Built on the workflow engine's timer primitive.

### 2.4 Workflow engine
- **Durable execution.** Each workflow run is a deterministic program whose
  state survives crashes; activities (side effects) are retried with backoff;
  failures are inspectable.
- Candidates: **Temporal** (self‑host or Cloud), **Inngest**, **Cloudflare
  Workflows**. Decision recorded in [ADR‑0001](#adr-0001-workflow-runtime)
  below.
- Step types implemented as **activities**:
  - `edc.*` (loan get, field set, milestone advance, conditions create,
    docs send, contacts, pipeline, services).
  - `epc.*` (Partner Connect — when ordering services through marketplace).
  - `ai.*` (chat, classify, extract, redact, summarize, tool‑use).
  - `human.task.*` (assign, wait‑for‑approval).
  - `notify.*` (email, Slack, MS Teams, SMS).
  - `data.*` (transform, map, validate against JSON Schema).
  - `flow.*` (branch, parallel, foreach, subworkflow).

### 2.5 ICE adapter layer
- Single typed client wrapping EDC + EPC + TPO Connect endpoints, with:
  - OAuth 2.0 token cache + refresh
  - Per‑tenant credential store (KMS‑encrypted)
  - Rate limiting (token‑bucket per tenant)
  - Sandbox vs prod base URL switching
  - Retry policy informed by EDC error semantics
- The workflow YAML never speaks raw HTTP — it uses named tools
  (`edc.loan.get`) which the adapter implements.

### 2.6 AI layer
- Calls Claude via Anthropic SDK with:
  - **Prompt caching** (system + tool defs + retrieved loan context cached;
    per‑run user message uncached).
  - **Structured output** via JSON Schema; reject / retry on schema fail.
  - **Tool use** for steps where the model decides which EDC action to take
    next (only inside narrowly‑scoped subworkflows).
  - **Per‑step model selection** — Opus for high‑judgment, Sonnet/Haiku for
    extraction or classification.
- All prompts live in a versioned **prompt registry**; runs record the prompt
  hash, model id, input, and output.

### 2.7 State store
- Postgres (Supabase candidate per tooling already available).
- Schemas:
  - `tenants`, `users`, `roles`, `oauth_credentials`
  - `workflows` (definition, version), `workflow_runs`, `workflow_steps`
  - `events_raw` (webhook archive), `events_processed`
  - `human_tasks`, `audit_log`, `prompts`, `prompt_versions`
  - `field_maps` (logical → tenant Encompass field IDs)

### 2.8 Console (Next.js)
- Workflow designer (YAML editor + visual graph).
- Live run viewer (timeline of steps, AI inputs/outputs, replay).
- Inbox for human approval steps.
- Prompt registry browser + diff.
- Audit / export.

## 3. Multi‑tenancy

- One Postgres schema per tenant **or** row‑level security with `tenant_id` —
  RLS preferred for operational simplicity.
- Per‑tenant Encompass client_id / client_secret stored encrypted; never
  surfaced in workflow YAML.
- Per‑tenant LLM key allowed (BYO‑key) for compliance‑sensitive customers.

## 4. Environments

Each tenant has at least:
- **sandbox** — bound to ICE EDC sandbox host
- **production** — bound to ICE EDC production host

Workflows are promoted sandbox → production via a versioned release (git‑style
ref). The runtime refuses to run a `production` ref against a `sandbox`
credential set, and vice versa.

## 5. Determinism, replay, idempotency

- Every step receives a stable `runId` + `stepId`. Side‑effect activities use
  these as **idempotency keys** when calling EDC (e.g. on retried `loan.field.set`).
- The workflow engine guarantees deterministic replay; `now()`, randomness, and
  IO must go through engine‑provided primitives.
- AI calls are non‑deterministic, but we record input + output verbatim;
  on replay the recorded output is reused.

## 6. Security & compliance

See [`SECURITY.md`](SECURITY.md). Highlights:
- OAuth 2.0 to EDC, with per‑integration scopes; refresh tokens in KMS.
- Webhook signature verification.
- PII redaction policy applied **before** any payload reaches the LLM, with
  per‑tenant policy and a deny‑by‑default for SSN/DOB/account numbers in
  prompt bodies.
- Immutable, hash‑chained audit log per run.
- RBAC: `viewer`, `author`, `approver`, `admin`.

## 7. Observability

- OpenTelemetry traces per run; one span per step.
- Structured logs with `runId`, `tenantId`, `loanId`, `workflowId`,
  `workflowVersion`, `stepId`.
- Metrics: run throughput, p50/p95 step latency, AI tokens, EDC error rates,
  human‑task SLA breaches.

## 8. Failure model

- Webhook lost → reconciler emits synthetic event within ≤5 min.
- EDC 5xx → activity retries with capped exponential backoff.
- EDC 4xx (auth/scope) → run fails fast, page on‑call.
- AI invalid output → up to N retries with reflection, then fall back to
  human task.
- Engine crash → all in‑flight runs resume from last completed step.

## 9. ADRs

### ADR‑0001: Workflow runtime
- **Status**: Open
- **Options**:
  1. **Temporal** — most mature; explicit primitives; we self‑host or use
     Temporal Cloud.
  2. **Inngest** — lower ops burden; great DX; opinionated.
  3. **Cloudflare Workflows** — fits well if we deploy on CF; cheap; younger.
- **Recommendation**: Start with **Temporal Cloud** for production
  reliability. Revisit if cost becomes painful and CF Workflows reaches
  feature parity.

### ADR‑0002: Workflow definition format
- **Status**: Decided — YAML with JSON Schema validation.
- **Why**: human‑editable, diff‑friendly in PRs, tooling already exists.
  TypeScript SDK can compile YAML into typed runtime objects.

### ADR‑0003: AI provider
- **Status**: Decided — Anthropic Claude.
- **Why**: structured outputs, tool use, long context handle whole loan files,
  prompt caching reduces cost on repeated step contexts.

### ADR‑0004: Field mapping
- **Status**: Decided — logical field aliases in workflows; tenant‑level
  alias → Encompass field ID map maintained in DB and editable in console.
- **Why**: tenants customize Encompass fields heavily; workflows must remain
  portable.
