# ICE API Surface — what we depend on

This document captures the slice of ICE Mortgage Technology APIs the platform
integrates with. It is a **contract sketch**, not a copy of the official docs.
The source of truth is
<https://developer.icemortgagetechnology.com/developer-connect/docs/welcome>.

## 1. Products in play

| Product | What we use it for |
|---|---|
| **Encompass Developer Connect (EDC)** | Custom in‑lender REST API for loan data, pipeline, contacts, documents, milestones, conditions, services |
| **Encompass Partner Connect (EPC)** | Partner‑side REST API for ordering / responding to services through the marketplace |
| **TPO Connect** | Broker‑facing portal — surfaces field changes, doc uploads, package submissions that flow through EDC events on the Encompass side |
| **Send Encompass Docs APIs** | Generate and deliver opening (3‑day) and closing disclosure / doc sets to Consumer Connect (borrower) and Loan Connect (3rd party) recipients |
| **Webhooks** | Event delivery for loan field changes, milestone events, document events, and service events |

## 2. Authentication

- **OAuth 2.0** with client credentials and/or authorization code flows.
- Per‑tenant `client_id` / `client_secret` issued by ICE.
- API user provisioned in Encompass admin with scoped persona.
- **Tokens are short‑lived** — adapter caches and refreshes; never logged.
- Sandbox host and production host are different and require different
  credentials. The platform models environments as a first‑class concept.

## 3. Webhook scopes we subscribe to

Webhook subscriptions are defined as `(resource, events, endpoint)`. We
subscribe to at least:

| Resource | Events | Why |
|---|---|---|
| `loan` | `create`, `update`, `delete` | Drive most workflows |
| `loan.fieldChange` (EFC) | `change` (with old + new) | Field‑level triggers, esp. for TPO submissions |
| `loan.milestone` | `complete`, `start`, `revert` | Milestone‑driven automations |
| `loan.documents` | `add`, `update` | Doc indexing, condition extraction |
| `loan.conditions` | `add`, `clear`, `update` | Condition lifecycle automations |
| `loan.services` | `order`, `update`, `complete` | Service order babysitter |
| `pipeline` | `update` | Bulk reconciliation triggers |

Each subscription points at a tenant‑scoped endpoint of ours.

### Webhook handling rules

1. **Signature / secret verification** on every inbound POST.
2. **At‑least‑once** semantics — dedupe by `(tenantId, eventId)`.
3. **No strict ordering** — workflows that care about order use
   `loan.lastModified` or fetch the loan resource after the event.
4. **Reconciliation sweep** every 5 min using EDC pipeline `lastModified` to
   recover dropped events.
5. **Fast 200**: store and enqueue, then process async.

## 4. EDC endpoints (logical names → REST verbs)

The workflow language never references raw HTTP. It uses **named tools** that
the ICE adapter maps to endpoints. Approximate mapping below; concrete URLs
live in the adapter.

| Tool name | Maps to | Notes |
|---|---|---|
| `edc.loan.get` | `GET /encompass/v3/loans/{loanId}` | Field selection supported |
| `edc.loan.create` | `POST /encompass/v3/loans` | |
| `edc.loan.update` | `PATCH /encompass/v3/loans/{loanId}` | Field‑level patching, idempotency key required |
| `edc.loan.field.get` | `GET /encompass/v3/loans/{loanId}/fields` | Bulk field read |
| `edc.loan.field.set` | `PATCH /encompass/v3/loans/{loanId}/fields` | Logical field aliases resolved by tenant map |
| `edc.loan.milestone.list` | `GET .../milestones` | |
| `edc.loan.milestone.advance` | `POST .../milestones/{id}/complete` | |
| `edc.loan.milestone.revert` | `POST .../milestones/{id}/revert` | |
| `edc.loan.conditions.list` | `GET .../conditions` | Underwriting + post‑closing |
| `edc.loan.conditions.create` | `POST .../conditions` | |
| `edc.loan.conditions.clear` | `POST .../conditions/{id}/clear` | |
| `edc.loan.documents.list` | `GET .../documents` | |
| `edc.loan.documents.upload` | `POST .../documents` | |
| `edc.loan.documents.download` | `GET .../documents/{id}/attachments/{aid}` | Binary; streams to object store |
| `edc.loan.contacts.*` | `GET / POST .../contacts` | Borrower, broker, settlement |
| `edc.loan.associates` | `GET / PATCH .../associates` | Loan team assignment |
| `edc.send_docs.opening` | `POST /sendDocs/opening` | 3‑day package generation + delivery |
| `edc.send_docs.closing` | `POST /sendDocs/closing` | Closing package |
| `edc.send_docs.on_demand` | `POST /sendDocs/onDemand` | On‑demand forms |
| `edc.send_docs.audit` | `POST /sendDocs/audit` | Pre‑audit before generation |
| `edc.pipeline.search` | `POST /pipeline` | Used by reconciler + bulk workflows |
| `edc.services.*` | EPC endpoints | Credit, VOI/VOE, appraisal, flood, etc. |

## 5. TPO Connect specifics

TPO Connect is a **portal**, not a separate API. The platform reacts to TPO
events that surface in EDC as field changes on the loan (e.g. broker
submission button → `Loan.SubmittedToLender = true`) and as document uploads
into the loan file. The platform does **not** call TPO Connect directly —
side effects (returning a loan to the broker, posting a comment) flow back
through EDC.

When ICE exposes a direct TPO Connect API in future versions, we add an
`tpo.*` namespace to the adapter without changing workflow YAML.

## 6. Rate limiting & quotas

- Per‑tenant token‑bucket sized below ICE's documented limits.
- Backoff on 429 with `Retry‑After` honored.
- Long‑running pulls (e.g. document downloads) run on a separate, lower‑pri
  queue so they don't starve interactive workflows.

## 7. Sandbox parity

All workflows must be runnable end‑to‑end in EDC sandbox. The CI test suite
spins up a fixture loan in sandbox and exercises every step. Workflows that
require production‑only services (real credit pulls, real disclosure delivery)
mark those steps with `env: production-only` and stub them in sandbox runs.
