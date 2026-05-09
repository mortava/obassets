# Security & Compliance

Mortgage data is regulated (GLBA, state privacy laws, CCPA‑type variants).
The platform's default posture is **deny‑by‑default**, with policy decisions
recorded in audit.

## 1. Authentication & authorization

### 1.1 To ICE
- OAuth 2.0 — client credentials for service‑level workflows, authorization
  code flow when a workflow acts on behalf of a specific user.
- One `client_id` per tenant per environment (sandbox / production).
- Tokens never logged. Refresh tokens stored in a KMS‑encrypted secret store.
- Encompass API user is provisioned with the **least‑privilege persona**
  required for the workflow set; we do not use super‑admin keys for runtime.

### 1.2 Console / API
- SSO via OIDC or SAML for tenant users.
- Service accounts use signed JWTs with short‑lived access tokens.
- RBAC: `viewer`, `author`, `approver`, `admin`. Author can edit drafts;
  only `admin` can promote a workflow version to production.

## 2. Webhooks

- Each tenant has a unique webhook secret used to sign / verify inbound
  requests; rotated on schedule and on demand.
- Endpoints reject requests without a valid signature.
- Raw payloads are archived for 30 days for forensics, then aged out.

## 3. PII handling

- Loan files contain SSN, DOB, account numbers, income, balances.
- Per‑tenant **redaction policy** declares which field classes can be sent to
  external LLMs. Defaults:
  - `ssn`, `dob`, `accountNumber` — **never** sent in prompt body
  - `name`, `address`, `email`, `phone` — sent only if `pii.contact = allow`
  - all numeric loan attributes — allowed by default
- The AI activity wrapper applies the policy **before** any external call;
  the redacted payload is what goes to the prompt and what is logged.
- Tenants can opt into **BYO‑key** so prompts go to their own Anthropic
  account directly.

## 4. Critical platform policies

The platform enforces a small set of non‑negotiable rules that cannot be
overridden in band by any workflow, AI step, or user instruction. They live in
[`knowledge/policies/`](../knowledge/policies/) and are loaded by AI agents
and enforced by the runtime.

| Policy | Severity | Where |
|---|---|---|
| **No deletion of Encompass data — of any type, ever** | critical | [`knowledge/policies/no-deletion.md`](../knowledge/policies/no-deletion.md) |

Each policy is enforced at multiple layers (catalog filter, portal preflight,
runtime adapter allowlist, AI tool whitelist) so a single bug cannot bypass
it. See the policy files for the full enforcement chain.

## 5. Audit log

- Append‑only, hash‑chained; each entry references the prior entry's hash.
- Entries:
  - Workflow version published / promoted / rolled back
  - Run start, step start/end, AI call (with prompt id + version + token
    counts), human approval, side effect to EDC (with idempotency key),
    error
- Exportable as a signed bundle for compliance reviews.

## 6. Data retention

- Run state: 13 months default; configurable per tenant.
- Webhook archive: 30 days.
- AI prompt + response logs: 13 months; redacted view available indefinitely.
- Document binaries: not stored; downloaded transiently and discarded after
  the workflow run unless a step explicitly persists.

## 7. Network & infrastructure

- All traffic over TLS 1.2+.
- Outbound to ICE is allow‑listed by domain; outbound elsewhere requires a
  registered tool definition with its own allowlist.
- Secrets in KMS; runtime services receive ephemeral credentials.
- Per‑tenant data isolated via row‑level security in Postgres.

## 8. Compliance roadmap

- SOC 2 Type II readiness in Phase 3 (Roadmap).
- Vendor risk: any new third‑party tool used by a step requires a documented
  data flow and a tenant‑level opt‑in.
- Data residency: pinning support (US default) added when first tenant
  requires it.
