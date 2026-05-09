# Critical platform policies

These are the **non‑negotiable** rules the OpenBroker workflow platform
enforces against every workflow, every AI step, every adapter call.

| Policy | Severity | Source of truth |
|---|---|---|
| Never delete data in Encompass — of any type, ever | **critical** | [`knowledge/policies/no-deletion.md`](knowledge/policies/no-deletion.md) |

Each policy is enforced at multiple layers (defense in depth) so a single
bug, prompt injection, or hallucinated AI tool call cannot bypass it. See
the linked file for the full enforcement chain and override procedure.

Adding or relaxing a policy requires a written change request approved by
platform engineering and compliance, and the policy file must be updated
**first**, before any code changes.
