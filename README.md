# OpenBroker Labs — AI Workflow Platform for Encompass & TPO Connect

A platform to design, run, and observe **AI‑augmented automated workflows** that
plug into ICE Mortgage Technology's **Encompass** LOS and **TPO Connect** portal
through the Encompass Developer Connect (EDC) and Partner Connect (EPC) APIs.

This repository currently holds the **plan, architecture, and workflow schema**
that will drive the implementation. No application code yet — the goal of this
branch is to align on what we are building before we build it.

## Contents

| Path | Purpose |
|---|---|
| [`docs/PLAN.md`](docs/PLAN.md) | Product plan, goals, scope, non‑goals |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | System architecture & components |
| [`docs/ICE_API_SURFACE.md`](docs/ICE_API_SURFACE.md) | The slice of EDC / EPC / TPO Connect we depend on |
| [`docs/WORKFLOW_MODEL.md`](docs/WORKFLOW_MODEL.md) | Declarative workflow model (triggers, steps, AI calls) |
| [`docs/ROADMAP.md`](docs/ROADMAP.md) | Phased delivery plan |
| [`docs/SECURITY.md`](docs/SECURITY.md) | Auth, secrets, PII, audit |
| [`workflows/schema/workflow.schema.json`](workflows/schema/workflow.schema.json) | JSON Schema for workflow definitions |
| [`workflows/examples/`](workflows/examples) | Reference workflow definitions |
| [`workflows/templates/`](workflows/templates) | Reusable snippets (auth, notifiers, AI prompts) |

## TL;DR

A user defines a workflow in YAML such as:

```yaml
trigger:
  source: encompass.webhook
  resource: loan
  events: [milestone.completed]
  filter: "milestone == 'Submittal' && loan.channel == 'Wholesale'"

steps:
  - id: pull_loan
    use: edc.loan.get
    with: { loanId: "{{ trigger.loanId }}" }

  - id: ai_review
    use: ai.classify
    with:
      model: claude-opus-4-7
      prompt_template: tpo_submission_review
      input: "{{ steps.pull_loan.output }}"
      schema: schemas/submission_review.json

  - id: branch
    if: "ai_review.output.recommendation == 'return_to_broker'"
    then:
      - use: edc.loan.conditions.create
        with: { loanId: "{{ trigger.loanId }}", conditions: "{{ ai_review.output.conditions }}" }
      - use: edc.send_docs.opening
        with: { loanId: "{{ trigger.loanId }}", package: "broker_return_pkg" }
    else:
      - use: edc.loan.milestone.advance
        with: { loanId: "{{ trigger.loanId }}", to: "Setup" }
```

…and the platform handles webhook ingestion, OAuth, retries, observability,
human approvals, and audit.

## Design principles

1. **Declarative first.** Workflows are data, not code. Versioned, diffable,
   reviewable.
2. **AI is a step, not the system.** LLMs run inside steps with strict
   structured output. The workflow engine stays deterministic.
3. **Mortgage‑native.** Concepts like milestones, conditions, fields, channels,
   plan codes, and disclosure packages are first‑class.
4. **Observable.** Every run is replayable; every AI call is logged with inputs,
   outputs, prompts, and model version.
5. **Compliant by default.** PII redaction, audit trail, scoped credentials,
   no data leaves the tenant boundary without explicit policy.
