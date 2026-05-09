# Workflow model

A workflow is a **YAML document** validated against
[`workflows/schema/workflow.schema.json`](../workflows/schema/workflow.schema.json).

## 1. Top‑level shape

```yaml
apiVersion: obl.workflows/v1
kind: Workflow
metadata:
  id: tpo-submission-triage
  version: 3
  owner: tpo-ops@example.com
  description: |
    When a wholesale broker submits a file, run AI triage and either
    return-to-broker with conditions or advance to Setup.

trigger: { ... }      # exactly one
inputs:  { ... }      # optional declared inputs (for manual / subworkflow runs)
context: { ... }      # constants & lookups available as {{ context.* }}
steps:   [ ... ]      # ordered list of step objects
on_error: { ... }     # optional default error policy
```

## 2. Triggers

Exactly one trigger per workflow. Supported sources:

| Source | Shape |
|---|---|
| `encompass.webhook` | `{ resource, events[], filter? }` |
| `encompass.field_change` | `{ field, op?: equals/changes/exists, filter? }` (sugar over webhook) |
| `encompass.milestone` | `{ milestone, event: started/completed/reverted, filter? }` |
| `encompass.document` | `{ docType?, event: added/updated, filter? }` |
| `schedule` | `{ cron, tz, scope: pipeline-query }` |
| `manual` | `{ inputs }` (runs from console / API) |
| `subworkflow` | invoked by another workflow |

`filter` is a CEL‑like expression that runs against the trigger payload + a
just‑fetched view of the loan. Workflows do not begin execution unless
`filter` evaluates true.

## 3. Step shape

Every step is one object in the `steps` array.

```yaml
- id: <stable_step_id>          # required, stable across versions for replay
  use: <tool_name>              # one of edc.*, ai.*, human.*, notify.*, flow.*
  with: { ... }                 # tool-specific inputs (templated)
  if: <expr>                    # skip step unless expression true
  retry:                        # override default retry policy
    max_attempts: 5
    backoff: exponential
    on: [5xx, network]
  timeout: 30s
  output: <name>                # optional alias; default uses `id`
  on_error:                     # local error handler
    use: human.task.create
    with: { title: "Step failed: {{ steps.<id>.error.message }}" }
```

### 3.1 Templating

`{{ ... }}` Mustache‑style references resolve against:

- `trigger.*` — incoming event fields
- `inputs.*` — declared inputs
- `context.*` — constants
- `steps.<id>.output.*` — prior step outputs
- `loan.*` — sugar for the most recently fetched loan view
- `tenant.*` — tenant config (timezone, env, field map aliases)

Expressions in `if` / `filter` use a small CEL‑like grammar: comparison,
boolean ops, `in`, `matches`, `len()`, `now()`. No arbitrary code.

## 4. Step kinds

### 4.1 EDC tools (`edc.*`)
Wrap the typed ICE adapter — see [`ICE_API_SURFACE.md`](ICE_API_SURFACE.md).
Inputs use **logical field aliases** resolved per tenant. Side effects always
include an idempotency key derived from `(runId, stepId, attempt)`.

### 4.2 AI tools (`ai.*`)
| Tool | Purpose |
|---|---|
| `ai.classify` | Pick one label from an enum given input + prompt |
| `ai.extract` | Extract a structured object from unstructured text/doc |
| `ai.summarize` | Produce a short summary in a fixed format |
| `ai.review` | Apply a checklist; output structured findings + score |
| `ai.redact` | Mask PII fields (called transparently before any external AI step if policy requires) |
| `ai.tools` | Free‑form tool‑use loop within a **whitelisted** subset of `edc.*` tools (used sparingly, inside a `flow.subworkflow` only) |

All AI steps require:
- `model`: `claude-opus-4-7` | `claude-sonnet-4-6` | `claude-haiku-4-5-20251001`
- `prompt`: registry id + version (`prompts/tpo_submission_review@4`)
- `output_schema`: JSON Schema; outputs that fail validation trigger a single
  reflection retry, then fail the step.

### 4.3 Human tasks (`human.task.*`)
| Tool | Purpose |
|---|---|
| `human.task.create` | Open a task in the console inbox |
| `human.task.wait_approval` | Pause until approver acts; returns `{approved, comment, by}` |
| `human.task.assign` | Set assignee or queue |

A human task includes the **AI suggestion**, the **evidence** (links to docs,
field values), and the **action that will be taken if approved**.

### 4.4 Flow tools (`flow.*`)
| Tool | Purpose |
|---|---|
| `flow.if` | Conditional branch with `then` / `else` step lists |
| `flow.parallel` | Run branches concurrently; join with named outputs |
| `flow.foreach` | Iterate a list (e.g. each condition, each document) |
| `flow.subworkflow` | Invoke another workflow synchronously |
| `flow.wait` | Wait for an event, signal, or duration |
| `flow.return` | Stop the workflow with a result |

### 4.5 Notify tools (`notify.*`)
Email, Slack, MS Teams, SMS — all wrapped with templates and tenant‑level
delivery policy (e.g. quiet hours).

## 5. Versioning & promotion

- Each workflow has `metadata.version` (monotonic).
- The runtime **never silently upgrades** an in‑flight run; runs always
  complete on the version they started under.
- New versions are deployed via PR + console release. Sandbox → production
  promotion is explicit.

## 6. Idempotency contract

The platform guarantees:

1. The same `(runId, stepId)` will not produce two distinct EDC side effects.
2. AI step outputs are recorded; on replay the recorded output is reused.
3. Human task acceptance is recorded once; replay uses the recorded decision.

Workflow authors can therefore treat retries as safe.

## 7. Testing

Workflows ship with `tests/*.yaml` files containing canned trigger payloads,
mock loan fixtures, and AI mock outputs. CI runs:

- **Schema validation** — every workflow YAML against the JSON Schema.
- **Dry run** — execute steps with the ICE adapter swapped for an in‑memory
  fixture; assert sequence + outputs.
- **Sandbox run** — full execution against EDC sandbox in nightly CI.

## 8. What a "good" workflow looks like

- ≤ 30 steps; deeper logic factored into subworkflows.
- Every AI step has a tightly‑scoped JSON Schema for output.
- No EDC side effects in the first 2 steps (always pull state first).
- Every human task has a pre‑filled draft action and a clear "what happens
  if approved" sentence.
- Errors fan in to a single `on_error` policy at the top level.
- The workflow makes sense to a non‑engineer reading the YAML out loud.
