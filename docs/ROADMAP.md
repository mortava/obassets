# Roadmap

Three phases. Each phase ships something usable on its own.

## Phase 0 — Plan & alignment (this branch)

- [x] Plan, architecture, ICE API surface, workflow model docs
- [x] Workflow JSON Schema v1
- [x] Three reference workflow YAMLs covering distinct shapes
- [ ] Stakeholder review and sign‑off on workflow model
- [ ] Pick workflow runtime (ADR‑0001) and LLM serving plan

Exit criteria: this repo's docs are the agreed contract.

## Phase 1 — "It runs" (weeks 1–6)

Goal: a single workflow runs end‑to‑end against EDC sandbox, with audit and
console visibility.

- [ ] Repo skeleton: `apps/console`, `apps/runtime`, `packages/ice-adapter`,
      `packages/workflow-sdk`, `packages/prompts`
- [ ] ICE adapter: OAuth 2.0 client credentials flow, token cache, sandbox env,
      first 8 EDC tools (`loan.get`, `field.get`, `field.set`,
      `milestone.list`, `milestone.advance`, `documents.list`,
      `conditions.list`, `conditions.create`)
- [ ] Webhook ingestor: signature verification, archive, dedupe, enqueue
- [ ] Workflow engine bootstrap (Temporal Cloud or chosen alternative)
- [ ] YAML → typed runtime compiler with JSON Schema validation
- [ ] AI activity wrapping Claude with prompt cache, structured outputs,
      retries on schema fail
- [ ] Postgres schemas + migrations: tenants, runs, steps, audit, prompts
- [ ] Console v0: list workflows, watch a single live run, view step
      inputs/outputs, approve a human task
- [ ] Reference workflow `tpo-submission-triage` running on a sandbox loan

Exit criteria: a TPO ops user sees a sandbox loan flow through AI triage
and either return‑to‑broker or advance to setup, with full audit trail.

## Phase 2 — "It scales" (weeks 7–14)

Goal: multi‑tenant production deployment with several lender lanes live.

- [ ] Multi‑tenant: row‑level security, per‑tenant credential vaulting
- [ ] Production OAuth (auth code flow) for tenants who require it
- [ ] Reconciler sweep against EDC pipeline `lastModified`
- [ ] Field‑map admin in console (logical alias → tenant Encompass field id)
- [ ] PII redaction policies + per‑tenant redaction config
- [ ] Prompt registry UI + diff + version pinning
- [ ] Workflow designer (visual graph + YAML round‑trip)
- [ ] Human task inbox with SLA timers, reassignment, comments
- [ ] Reference workflows live:
  - `tpo-submission-triage`
  - `condition-extraction-from-disclosed-docs`
  - `service-order-babysitter`
  - `closing-package-readiness-check`
- [ ] Observability: OTel traces, AI‑cost dashboard, error budgets
- [ ] On‑call runbook + incident tooling

Exit criteria: ≥3 lenders running ≥4 workflows in production with full
audit + RBAC + prompt versioning.

## Phase 3 — "It composes" (weeks 15+)

Goal: workflow authors at lender orgs build their own without our help.

- [ ] Workflow marketplace (publish, fork, install)
- [ ] Subworkflows + reusable step packs (auth bundles, common notifiers,
      doc‑indexing primitives)
- [ ] Custom step SDK (TypeScript) for tenant engineers to add private steps
- [ ] AI step library: domain‑tuned prompts shipped + versioned
- [ ] Bulk / batch mode (run a workflow over a pipeline query)
- [ ] BYO‑model support (tenant‑provided Anthropic key, region pinning)
- [ ] SOC 2 readiness, data‑residency controls, signed audit export

Exit criteria: 50% of new workflows are authored by tenant teams.

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| ICE webhook deliveries are best‑effort and unordered | Reconciler + dedupe + idempotent steps |
| Encompass field IDs vary per tenant | Logical aliases + per‑tenant field map |
| LLM outputs sometimes off‑schema | Schema validation + reflection retry + human fallback |
| PII leaking into prompts | Redaction policy enforced in AI activity wrapper |
| Run cost runaway | Per‑tenant AI spend cap + step timeouts + per‑model selection |
| Sandbox vs prod mismatch | Env as first‑class concept; CI runs sandbox parity tests |
| Vendor lock‑in to runtime | Workflow YAML is portable; runtime is replaceable behind compiler |
