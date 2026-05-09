import type { Workflow, Connection, Run } from "./types";

export const SAMPLE_WORKFLOWS: Workflow[] = [
  {
    id: "tpo-submission-triage",
    name: "TPO submission triage",
    description:
      "When a wholesale broker submits a file, run AI triage and either return it with conditions or advance to Setup.",
    status: "live",
    env: "production",
    trigger: {
      source: "encompass.field_change",
      field: "Loan.SubmittedToLender",
      op: "equals",
      value: true,
    },
    steps: [
      { id: "pull_loan", use: "edc.loan.get", with: { loanId: "{{ trigger.loanId }}", fields: "loanAmount, channel, milestones, documents" } },
      { id: "ai_triage", use: "ai.review", with: { model: "claude-opus-4-7", prompt: "prompts/tpo_submission_review@4", input: "{{ steps.pull_loan.output }}", output_schema: "schemas/tpo_triage.json" } },
      { id: "branch", use: "flow.if", with: { condition: "steps.ai_triage.output.recommendation == 'return_to_broker'" } },
      { id: "approve_return", use: "human.task.wait_approval", with: { title: "Return TPO submission to broker?", assignee_role: "tpo_ops_lead", sla: "2h" } },
      { id: "send_return", use: "edc.send_docs.on_demand", with: { loanId: "{{ trigger.loanId }}", package: "broker_return_pkg", recipients: "tpo_broker" } },
    ],
    createdAt: "2026-04-12T10:00:00Z",
    updatedAt: "2026-05-01T12:00:00Z",
    runs: 412,
    lastRunAt: "2026-05-09T07:42:00Z",
    successRate: 0.97,
  },
  {
    id: "condition-extraction",
    name: "Condition extraction from disclosed docs",
    description:
      "When a doc lands in Underwriting Conditions, AI extracts findings and reconciles against open conditions.",
    status: "live",
    env: "production",
    trigger: { source: "encompass.document", event: "added" },
    steps: [
      { id: "download_doc", use: "edc.loan.documents.download", with: { loanId: "{{ trigger.loanId }}", documentId: "{{ trigger.document.id }}" } },
      { id: "extract", use: "ai.extract", with: { model: "claude-sonnet-4-6", prompt: "prompts/condition_extract@7", input: "{{ steps.download_doc.output }}", output_schema: "schemas/condition_extraction.json" } },
      { id: "auto_clear", use: "edc.loan.conditions.clear", with: { loanId: "{{ trigger.loanId }}", conditionId: "{{ steps.extract.output.match.conditionId }}" } },
    ],
    createdAt: "2026-03-22T09:00:00Z",
    updatedAt: "2026-04-28T15:30:00Z",
    runs: 1284,
    lastRunAt: "2026-05-09T08:11:00Z",
    successRate: 0.92,
  },
  {
    id: "service-order-babysitter",
    name: "Service order SLA babysitter",
    description:
      "Every 30 minutes, find stalled credit/VOI/VOE/appraisal orders and draft an AI follow-up for human approval.",
    status: "paused",
    env: "production",
    trigger: { source: "schedule", cron: "*/30 * * * *", tz: "America/Los_Angeles" },
    steps: [
      { id: "list_breached", use: "edc.loan.get", with: { loanId: "[batch]", fields: "services" } },
      { id: "draft_followup", use: "ai.summarize", with: { model: "claude-haiku-4-5-20251001", prompt: "prompts/service_followup_draft@2" } },
      { id: "approve_send", use: "human.task.wait_approval", with: { title: "Send vendor follow-up?", assignee_role: "ops_processor", sla: "30m" } },
      { id: "send", use: "notify.email", with: { to: "{{ order.vendor.email }}", template: "service_vendor_followup" } },
    ],
    createdAt: "2026-02-15T11:00:00Z",
    updatedAt: "2026-04-10T14:00:00Z",
    runs: 86,
    lastRunAt: "2026-04-10T14:00:00Z",
    successRate: 0.88,
  },
  {
    id: "post-close-trailing-docs",
    name: "Post-close trailing doc pursuit",
    description:
      "After funding, chase trailing documents weekly until all are received.",
    status: "draft",
    env: "sandbox",
    trigger: { source: "encompass.milestone", milestone: "Funding", event: "completed" },
    steps: [
      { id: "list_required", use: "edc.loan.get", with: { loanId: "{{ trigger.loanId }}", fields: "trailingDocs" } },
    ],
    createdAt: "2026-05-08T16:00:00Z",
    updatedAt: "2026-05-08T16:00:00Z",
    runs: 0,
    lastRunAt: null,
    successRate: 0,
  },
];

export const SAMPLE_CONNECTIONS: Connection[] = [
  { id: "encompass", connected: true, account: "Acme Lending (sandbox)", env: "sandbox", connectedAt: "2026-04-01T10:00:00Z" },
  { id: "anthropic", connected: true, account: "team-key-prod", connectedAt: "2026-04-01T10:00:00Z" },
  { id: "slack", connected: true, account: "Acme Workspace", connectedAt: "2026-04-02T09:00:00Z" },
  { id: "email", connected: false },
];

export const SAMPLE_RUNS: Run[] = [
  {
    id: "run_01HV8X9",
    workflowId: "tpo-submission-triage",
    workflowName: "TPO submission triage",
    status: "succeeded",
    startedAt: "2026-05-09T07:42:00Z",
    durationMs: 4820,
    loanRef: "L-2026-04822",
    steps: [
      { id: "pull_loan", status: "ok", durationMs: 320 },
      { id: "ai_triage", status: "ok", durationMs: 3400 },
      { id: "branch", status: "ok", durationMs: 4 },
      { id: "approve_return", status: "skip", durationMs: 0 },
      { id: "advance_to_setup", status: "ok", durationMs: 96 },
    ],
  },
  {
    id: "run_01HV8X8",
    workflowId: "condition-extraction",
    workflowName: "Condition extraction from disclosed docs",
    status: "awaiting_human",
    startedAt: "2026-05-09T08:11:00Z",
    durationMs: 0,
    loanRef: "L-2026-04801",
    steps: [
      { id: "download_doc", status: "ok", durationMs: 540 },
      { id: "extract", status: "ok", durationMs: 4120 },
      { id: "auto_clear", status: "skip", durationMs: 0 },
    ],
  },
  {
    id: "run_01HV8WZ",
    workflowId: "tpo-submission-triage",
    workflowName: "TPO submission triage",
    status: "failed",
    startedAt: "2026-05-09T06:01:00Z",
    durationMs: 1820,
    loanRef: "L-2026-04790",
    steps: [
      { id: "pull_loan", status: "ok", durationMs: 320 },
      { id: "ai_triage", status: "fail", durationMs: 1500 },
    ],
  },
  {
    id: "run_01HV8WY",
    workflowId: "tpo-submission-triage",
    workflowName: "TPO submission triage",
    status: "succeeded",
    startedAt: "2026-05-09T05:14:00Z",
    durationMs: 4220,
    loanRef: "L-2026-04785",
    steps: [
      { id: "pull_loan", status: "ok", durationMs: 290 },
      { id: "ai_triage", status: "ok", durationMs: 3700 },
      { id: "branch", status: "ok", durationMs: 3 },
      { id: "advance_to_setup", status: "ok", durationMs: 220 },
    ],
  },
];

export const STARTER_TEMPLATES = [
  {
    id: "tpl-tpo-triage",
    name: "TPO submission triage",
    summary: "Broker submits → AI triage → return-to-broker or advance to Setup",
    icon: "ClipboardCheck",
    workflow: SAMPLE_WORKFLOWS[0],
  },
  {
    id: "tpl-condition-extract",
    name: "Condition extraction",
    summary: "Doc uploaded → AI pulls findings → auto-clear or escalate",
    icon: "FileSearch",
    workflow: SAMPLE_WORKFLOWS[1],
  },
  {
    id: "tpl-service-babysitter",
    name: "Service SLA babysitter",
    summary: "Schedule → find stalled orders → AI follow-up → human approve",
    icon: "Timer",
    workflow: SAMPLE_WORKFLOWS[2],
  },
  {
    id: "tpl-blank",
    name: "Start from scratch",
    summary: "Empty workflow — pick your trigger and steps yourself",
    icon: "Plus",
    workflow: null,
  },
];
