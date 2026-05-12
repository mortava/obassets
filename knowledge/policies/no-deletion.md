---
id: policy-no-deletion
kind: policy
severity: critical
title: Never delete data in Encompass — of any type, ever
appliesTo:
  - encompass
  - tpo-connect
  - encompass-web
  - edc-rest-api
  - epc-partner-connect
  - send-encompass-docs
enforcement:
  - portal-preflight
  - workflow-runtime-guardrail
  - ice-adapter-allowlist
addedAt: 2026-05-09
status: enforced
owner: platform-eng
overrideRequires: written admin override + audit-logged exception
---

# CRITICAL: No deletion of Encompass data

> **The platform must never delete any data in Encompass.**
> Not loans. Not documents. Not attachments. Not conditions. Not milestones.
> Not contacts. Not associates. Not fields. Not services. Not webhooks.
> Not configurations. **Nothing.** Ever.

This is a **non‑negotiable, enforced platform rule.** It applies to every
workflow, every AI step, every adapter call, every human action that the
platform takes on a tenant's behalf.

## What is forbidden

The platform will not call any operation whose effect is to remove,
permanently hide, or unrecoverably alter a record in Encompass. This includes
but is not limited to:

| Operation | Forbidden |
|---|---|
| `DELETE` HTTP method against any EDC / EPC endpoint | Yes |
| Loan deletion (`DELETE /encompass/v3/loans/{loanId}`) | Yes |
| Document or attachment deletion | **Yes — explicitly called out by policy** |
| Condition deletion | Yes |
| Milestone deletion or removal of milestone history | Yes |
| Contact, associate, or borrower removal | Yes |
| Webhook subscription deletion of *another* tenant or workflow's subscription | Yes |
| Field clear that destroys audit history (vs. setting to a new value) | Yes |
| Any "purge", "destroy", "remove", "wipe", or equivalent operation | Yes |
| AI tool‑use loop calling any of the above | Yes |

If an Encompass workflow legitimately needs something to "go away" (e.g., a
borrower asks to be forgotten, a duplicate loan needs cleanup), the request
is escalated to a **human admin** who handles it manually inside Encompass —
the platform never executes the deletion itself.

## What is allowed

These are explicitly *not* deletions and remain available:

- **Updating** field values to new values (the prior value is recorded in
  Encompass field history).
- **Marking** conditions cleared, or milestones reverted/skipped — these are
  state transitions, not data removal, and Encompass preserves the trail.
- **Pausing** or unsubscribing the platform's *own* webhook subscriptions
  (we manage those; we never touch a subscription owned by another integration).
- **Reading** anything we have permission to read.

## Why

1. **Data integrity.** Loan files are regulatory records. Deletion creates
   reconstruction nightmares for audit, compliance, and litigation.
2. **Blast radius.** A bug in a workflow, a hallucinated AI tool call, or a
   misclick on a webhook payload could cascade into thousands of deletions
   that are not reversible.
3. **Vendor trust.** Lenders trust ICE as the system of record. The platform
   does not get to undermine that trust.
4. **Audit obligation.** GLBA, state privacy regimes, investor reps and
   warrants — all assume records persist. Deletion violates the assumption.
5. **AI safety.** LLMs occasionally produce wrong tool calls. The cheapest
   way to make catastrophic AI errors impossible is to remove the
   catastrophic tools from the toolbox.

## Enforcement layers (defense in depth)

The rule is enforced **at every layer** so a single bug cannot bypass it:

1. **Catalog layer** (`lib/catalog.ts`) — no delete‑style tool
   exists. Adding one is blocked at module load time by `lib/guardrails.ts`.
2. **Portal preflight** (`components/wizard/ReviewStep.tsx`) —
   any workflow whose step `use` matches a forbidden pattern fails the
   review check with an **error** (blocking, not a warning). The user cannot
   advance to Publish.
3. **Workflow runtime adapter** (future ICE adapter package) — refuses the
   `DELETE` HTTP verb against any EDC / EPC host. Throws
   `ForbiddenOperationError` before the request leaves the process.
4. **AI tool‑use whitelist** — an `ai.tools` step (free‑form tool‑use loop)
   receives a tool list filtered through the same guardrail; the LLM
   physically cannot see a delete tool to call.
5. **Audit log** — any attempt to invoke a forbidden operation is logged with
   `severity=critical` and pages on‑call, even though the call is blocked.

## Override path

There is no in‑band override. A delete is only ever executed by a human admin
inside Encompass directly, with their own credentials, and that act is logged
in Encompass's own audit trail — outside the platform. If a future product
need genuinely requires the platform to perform a deletion, that requirement
goes through a written change request approved by platform engineering and
compliance, and this policy file is updated *first*, before any code changes.
