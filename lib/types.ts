// Core domain types for the workflow portal.
// Mirrors workflows/schema/workflow.schema.json.

export type Env = "sandbox" | "production";

export type WorkflowStatus = "draft" | "live" | "paused" | "error";

export type TriggerSource =
  | "encompass.webhook"
  | "encompass.field_change"
  | "encompass.milestone"
  | "encompass.document"
  | "schedule"
  | "manual";

export interface Trigger {
  source: TriggerSource;
  // Discriminated config — UI only writes the fields relevant to `source`.
  resource?: string;
  events?: string[];
  field?: string;
  op?: "equals" | "changes" | "exists" | "matches";
  value?: string | number | boolean;
  milestone?: string;
  event?: string;
  docType?: string;
  cron?: string;
  tz?: string;
  filter?: string;
}

export type StepCategory =
  | "ice"        // Read or write Encompass / TPO Connect data
  | "ai"         // Use AI to decide / extract / summarize
  | "human"      // Ask a person to approve or review
  | "notify"     // Send a message
  | "flow"       // Branch, loop, wait
  | "data";      // Transform values

export interface CatalogTool {
  id: string;          // e.g. "edc.loan.get"
  category: StepCategory;
  label: string;       // Short human label
  description: string; // One-sentence description
  inputs: ToolInput[]; // Form fields to render in the inspector
}

export interface ToolInput {
  name: string;
  label: string;
  kind: "string" | "text" | "select" | "boolean" | "number" | "json";
  required?: boolean;
  placeholder?: string;
  options?: { value: string; label: string }[];
  help?: string;
}

export interface Step {
  id: string;          // stable id, e.g. "pull_loan"
  use: string;         // catalog tool id
  with: Record<string, unknown>;
  if?: string;
  timeout?: string;
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  status: WorkflowStatus;
  env: Env;
  trigger: Trigger;
  steps: Step[];
  createdAt: string;
  updatedAt: string;
  // For dashboard stats:
  runs?: number;
  lastRunAt?: string | null;
  successRate?: number;
}

export interface ConnectionDef {
  id: "encompass" | "anthropic" | "slack" | "email";
  name: string;
  description: string;
  authKind: "oauth" | "api-key" | "webhook";
  required: boolean;
}

export interface Connection {
  id: ConnectionDef["id"];
  connected: boolean;
  account?: string;
  env?: Env;
  connectedAt?: string;
}

export interface Run {
  id: string;
  workflowId: string;
  workflowName: string;
  status: "succeeded" | "failed" | "running" | "awaiting_human";
  startedAt: string;
  durationMs: number;
  loanRef?: string;
  steps: { id: string; status: "ok" | "fail" | "skip"; durationMs: number }[];
}

// Wizard step ids (kept stable for the Stepper UI)
export type WizardStepId =
  | "goal"
  | "trigger"
  | "flow"
  | "connect"
  | "review"
  | "publish";
