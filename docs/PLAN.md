# Plan — AI Workflow Platform for Encompass & TPO Connect

## 1. Problem

Lenders running **Encompass** and exposing **TPO Connect** to brokers and
correspondents do most "automation" today through a mix of:

- Encompass business rules and field triggers
- Custom milestone templates and input form rules
- SDK plug‑ins (deprecated path)
- Hand‑coded webhook listeners that call EDC REST endpoints
- People in chat threads forwarding PDFs

That patchwork is brittle, hard to change, and impossible to audit. It also
leaves the most repetitive, judgment‑heavy work — broker submission review,
condition clearing, doc indexing, exception triage, status comms — to humans.

## 2. What we're building

A **platform** where ops, secondary, and TPO teams can define, run, and govern
**AI‑augmented automated workflows** that:

- Listen to Encompass / TPO Connect events (webhooks, milestones, field changes,
  doc uploads, service order responses).
- Pull loan data through EDC REST APIs.
- Call **LLMs** (Claude) for judgment‑heavy steps with **structured outputs**.
- Take action back in Encompass / TPO Connect — write fields, create
  conditions, advance milestones, send docs, post messages, route loans,
  request rerates.
- Bring a human into the loop only where policy requires it.
- Record everything — inputs, prompts, AI outputs, side effects — for audit.

## 3. Goals (the next 6 months)

- A **workflow definition language** (YAML) sufficient to model >80% of real
  TPO + retail post‑lock workflows.
- A **runtime** that can execute thousands of workflow instances/day with
  durable retries and idempotency.
- A **library** of starter workflows for the highest‑value lanes:
  - TPO broker submission triage
  - Condition extraction from disclosed docs
  - Disclosure timing and re‑disclosure decisioning
  - Service order (credit / VOI / VOE / appraisal) status babysitter
  - Closing package readiness check
  - Post‑close trailing doc pursuit
- A **console** to design workflows, watch live runs, intervene, and replay.
- **Audit + compliance** primitives: per‑tenant key isolation, PII redaction
  policies, signed run logs, role‑based access.

## 4. Non‑goals (for now)

- Replacing Encompass business rules engine wholesale.
- Building a new LOS or POS.
- Owning the borrower‑facing UI (Consumer Connect already exists).
- Generic, mortgage‑agnostic "AI workflows for everyone." Domain depth is the
  moat — we resist that pull.
- Being a model lab. We use frontier models via API; we do not train.

## 5. Users & what they do

| Role | What they do in the platform |
|---|---|
| Ops / TPO ops lead | Authors and edits workflows, tunes prompts, approves changes |
| Underwriter / processor | Receives AI‑prepared work, approves AI suggestions, handles exceptions |
| Compliance / audit | Reads run history, exports evidence, sets redaction & retention policies |
| Engineer (lender side) | Wires up new triggers, custom steps, integrates 3rd‑party services |
| Admin | Manages tenants, API keys, OAuth, RBAC, environments (sandbox vs prod) |

## 6. Success metrics

- **Time‑to‑clear‑to‑close** reduction on workflows we own (target: ‑20%).
- **Touch‑count** per file (target: ‑30% on TPO submissions).
- **Auto‑resolved conditions** rate (target: ≥40% on fully‑documented conds).
- **Workflow author velocity**: median time from idea → live workflow ≤ 1 day.
- **Run reliability**: ≥99.5% of runs complete or fail‑clean (no zombie runs).

## 7. Constraints & realities

- **EDC / EPC API rate limits and OAuth token lifetimes** drive a lot of the
  runtime design (token refresh, backoff, queueing).
- **Webhook delivery is at‑least‑once and not strictly ordered**; reconciliation
  is required (per ICE webhook best‑practices guidance).
- **Encompass field IDs are tenant‑configured.** The workflow language must let
  tenants map "logical" fields to their own field IDs.
- **NPI / GLBA**: borrower data is regulated. PII must never sit in third‑party
  prompt logs without explicit consent and redaction.
- **Sandbox vs production EDC** is a different host and different credentials —
  the platform must treat env as a first‑class concept.

## 8. Build vs buy decisions

| Decision | Choice | Why |
|---|---|---|
| Workflow definition format | YAML + JSON Schema | Diffable, reviewable, tool‑friendly |
| Workflow runtime | Durable execution engine (e.g. Temporal / Inngest / CF Workflows) — **decide in arch** | We need retries, timers, signals, replay |
| LLM provider | Anthropic Claude (Opus / Sonnet) | Strong tool use, structured outputs, long context for loan files |
| DB | Postgres | Audit, RBAC, multi‑tenant; Supabase candidate |
| Frontend | Next.js + React | Standard, fast to ship a console |
| Auth | OAuth 2.0 to EDC; SAML / OIDC for our console | What ICE expects + enterprise auth |

A standalone ADR will pick the runtime; see [`ARCHITECTURE.md`](ARCHITECTURE.md).

## 9. What's in this repo right now

This branch contains **plan + architecture + workflow model + schema +
example workflows only**. Implementation lives in follow‑on PRs once this is
agreed.
