import type { CatalogTool, ConnectionDef } from "./types";
import { assertCatalogClean } from "./guardrails";

// The tool catalog. Each entry maps to a real adapter call (see ICE_API_SURFACE.md).
// Inputs drive the StepInspector form rendering.
//
// CRITICAL: this catalog is filtered against knowledge/policies/no-deletion.md
// at the bottom of this file. Adding a delete/remove/purge/destroy tool here
// will throw at module load. See lib/guardrails.ts.

export const CATALOG: CatalogTool[] = [
  // ── Encompass / TPO Connect ────────────────────────────────────────────────
  {
    id: "edc.loan.get",
    category: "ice",
    label: "Get loan from Encompass",
    description: "Pull a loan and selected fields from Encompass.",
    inputs: [
      { name: "loanId", label: "Loan ID", kind: "string", required: true, placeholder: "{{ trigger.loanId }}" },
      { name: "fields", label: "Fields", kind: "text", placeholder: "loanAmount, propertyState, milestones" },
    ],
  },
  {
    id: "edc.loan.field.set",
    category: "ice",
    label: "Set fields on loan",
    description: "Write one or more fields back to the loan in Encompass.",
    inputs: [
      { name: "loanId", label: "Loan ID", kind: "string", required: true, placeholder: "{{ trigger.loanId }}" },
      { name: "fields", label: "Fields (JSON)", kind: "json", placeholder: "{ \"Loan.Status\": \"Approved\" }" },
    ],
  },
  {
    id: "edc.loan.milestone.advance",
    category: "ice",
    label: "Advance milestone",
    description: "Move the loan to the next milestone (e.g. Setup, Processing, UW).",
    inputs: [
      { name: "loanId", label: "Loan ID", kind: "string", required: true },
      { name: "to", label: "Target milestone", kind: "select", required: true, options: [
        { value: "Setup", label: "Setup" },
        { value: "Processing", label: "Processing" },
        { value: "Underwriting", label: "Underwriting" },
        { value: "Approval", label: "Approval" },
        { value: "Closing", label: "Closing" },
        { value: "Funding", label: "Funding" },
      ]},
    ],
  },
  {
    id: "edc.loan.conditions.create",
    category: "ice",
    label: "Create conditions",
    description: "Add one or more underwriting conditions to a loan.",
    inputs: [
      { name: "loanId", label: "Loan ID", kind: "string", required: true },
      { name: "conditions", label: "Conditions (JSON list)", kind: "json", placeholder: "[ { \"title\": \"...\" } ]" },
    ],
  },
  {
    id: "edc.loan.conditions.clear",
    category: "ice",
    label: "Clear condition",
    description: "Mark a condition as cleared with a comment.",
    inputs: [
      { name: "loanId", label: "Loan ID", kind: "string", required: true },
      { name: "conditionId", label: "Condition ID", kind: "string", required: true },
      { name: "comment", label: "Comment", kind: "text" },
    ],
  },
  {
    id: "edc.loan.documents.download",
    category: "ice",
    label: "Download document",
    description: "Pull a document attachment for inspection or AI extraction.",
    inputs: [
      { name: "loanId", label: "Loan ID", kind: "string", required: true },
      { name: "documentId", label: "Document ID", kind: "string", required: true },
    ],
  },
  {
    id: "edc.send_docs.opening",
    category: "ice",
    label: "Send opening docs (3-day)",
    description: "Generate and deliver the opening disclosure package.",
    inputs: [
      { name: "loanId", label: "Loan ID", kind: "string", required: true },
      { name: "package", label: "Package", kind: "string", placeholder: "default_opening_pkg" },
    ],
  },
  {
    id: "edc.send_docs.on_demand",
    category: "ice",
    label: "Send on-demand docs",
    description: "Send an ad-hoc package (e.g. broker return, missing items list).",
    inputs: [
      { name: "loanId", label: "Loan ID", kind: "string", required: true },
      { name: "package", label: "Package", kind: "string", required: true },
      { name: "recipients", label: "Recipients", kind: "string", placeholder: "tpo_broker, borrower" },
    ],
  },

  // ── AI ─────────────────────────────────────────────────────────────────────
  {
    id: "ai.review",
    category: "ai",
    label: "AI review (checklist)",
    description: "Run a checklist review and return structured findings.",
    inputs: [
      { name: "model", label: "Model", kind: "select", required: true, options: [
        { value: "claude-opus-4-7", label: "Claude Opus 4.7 (best judgement)" },
        { value: "claude-sonnet-4-6", label: "Claude Sonnet 4.6 (balanced)" },
        { value: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5 (fast/cheap)" },
      ]},
      { name: "prompt", label: "Prompt (registry id)", kind: "string", required: true, placeholder: "prompts/tpo_submission_review@4" },
      { name: "input", label: "Input expression", kind: "string", placeholder: "{{ steps.pull_loan.output }}" },
      { name: "output_schema", label: "Output schema", kind: "string", placeholder: "schemas/tpo_triage.json" },
    ],
  },
  {
    id: "ai.extract",
    category: "ai",
    label: "AI extract from document",
    description: "Pull structured data out of an uploaded document.",
    inputs: [
      { name: "model", label: "Model", kind: "select", required: true, options: [
        { value: "claude-sonnet-4-6", label: "Claude Sonnet 4.6 (recommended)" },
        { value: "claude-opus-4-7", label: "Claude Opus 4.7" },
      ]},
      { name: "prompt", label: "Prompt (registry id)", kind: "string", required: true },
      { name: "input", label: "Input expression", kind: "string", required: true },
      { name: "output_schema", label: "Output schema", kind: "string", required: true },
    ],
  },
  {
    id: "ai.classify",
    category: "ai",
    label: "AI classify",
    description: "Pick one label from a fixed set.",
    inputs: [
      { name: "model", label: "Model", kind: "select", required: true, options: [
        { value: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5 (recommended)" },
        { value: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
      ]},
      { name: "prompt", label: "Prompt (registry id)", kind: "string", required: true },
      { name: "labels", label: "Allowed labels (comma-sep)", kind: "string", required: true },
    ],
  },
  {
    id: "ai.summarize",
    category: "ai",
    label: "AI summarize",
    description: "Produce a short structured summary.",
    inputs: [
      { name: "model", label: "Model", kind: "select", options: [
        { value: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5" },
        { value: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
      ]},
      { name: "prompt", label: "Prompt (registry id)", kind: "string", required: true },
    ],
  },

  // ── Human ──────────────────────────────────────────────────────────────────
  {
    id: "human.task.wait_approval",
    category: "human",
    label: "Wait for human approval",
    description: "Pause the workflow and ask a teammate to approve.",
    inputs: [
      { name: "title", label: "Task title", kind: "string", required: true },
      { name: "assignee_role", label: "Assignee role", kind: "select", options: [
        { value: "tpo_ops_lead", label: "TPO Ops Lead" },
        { value: "underwriter", label: "Underwriter" },
        { value: "ops_processor", label: "Ops Processor" },
        { value: "compliance", label: "Compliance" },
      ]},
      { name: "sla", label: "SLA", kind: "select", options: [
        { value: "30m", label: "30 minutes" },
        { value: "2h", label: "2 hours" },
        { value: "24h", label: "24 hours" },
      ]},
    ],
  },

  // ── Notify ─────────────────────────────────────────────────────────────────
  {
    id: "notify.email",
    category: "notify",
    label: "Send email",
    description: "Send a templated email.",
    inputs: [
      { name: "to", label: "To", kind: "string", required: true, placeholder: "{{ loan.tpoBroker.email }}" },
      { name: "template", label: "Template", kind: "string", required: true, placeholder: "tpo_return_notice" },
    ],
  },
  {
    id: "notify.slack",
    category: "notify",
    label: "Post to Slack",
    description: "Post a structured message to a channel.",
    inputs: [
      { name: "channel", label: "Channel", kind: "string", required: true, placeholder: "#tpo-pipeline" },
      { name: "template", label: "Template", kind: "string", required: true },
    ],
  },

  // ── Flow ───────────────────────────────────────────────────────────────────
  {
    id: "flow.if",
    category: "flow",
    label: "If / else branch",
    description: "Branch based on a condition expression.",
    inputs: [
      { name: "condition", label: "Condition", kind: "string", required: true, placeholder: "steps.ai_triage.output.recommendation == 'return_to_broker'" },
    ],
  },
  {
    id: "flow.foreach",
    category: "flow",
    label: "For each item",
    description: "Run substeps once per item in a list.",
    inputs: [
      { name: "in", label: "List expression", kind: "string", required: true },
      { name: "as", label: "Loop variable", kind: "string", required: true, placeholder: "item" },
    ],
  },
  {
    id: "flow.wait",
    category: "flow",
    label: "Wait",
    description: "Pause for a duration or until a signal.",
    inputs: [
      { name: "for", label: "Duration", kind: "string", placeholder: "24h" },
    ],
  },
];

// Enforce the no-deletion policy at module load.
// If anyone adds a forbidden tool above, the build fails immediately.
assertCatalogClean(CATALOG);

export const CATALOG_BY_ID: Record<string, CatalogTool> =
  Object.fromEntries(CATALOG.map((t) => [t.id, t]));

export const CATEGORY_META: Record<string, { label: string; color: string; description: string }> = {
  ice:    { label: "Encompass / TPO",   color: "ink",   description: "Read or write loan data, milestones, conditions, docs" },
  ai:     { label: "AI",                color: "ai",    description: "Have AI review, extract, classify, or summarize" },
  human:  { label: "Human",             color: "amber", description: "Pause for approval or assign work" },
  notify: { label: "Notify",            color: "blue",  description: "Send email, Slack, MS Teams, SMS" },
  flow:   { label: "Flow control",      color: "ink",   description: "Branch, loop, wait" },
  data:   { label: "Data",              color: "ink",   description: "Transform, validate, map fields" },
};

export const CONNECTION_DEFS: ConnectionDef[] = [
  {
    id: "encompass",
    name: "Encompass / TPO Connect",
    description: "OAuth 2.0 to ICE Mortgage Technology — required for every workflow.",
    authKind: "oauth",
    required: true,
  },
  {
    id: "anthropic",
    name: "Anthropic (Claude)",
    description: "API key for AI review, extract, classify, summarize steps.",
    authKind: "api-key",
    required: false,
  },
  {
    id: "slack",
    name: "Slack",
    description: "Post messages to channels from notify.slack steps.",
    authKind: "oauth",
    required: false,
  },
  {
    id: "email",
    name: "Email (SMTP)",
    description: "Send templated emails from notify.email steps.",
    authKind: "api-key",
    required: false,
  },
];
