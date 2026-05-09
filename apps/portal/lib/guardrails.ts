// Runtime guardrails — enforced platform policies.
//
// These rules are non-negotiable. They are checked at multiple layers:
//   - module load (catalog cannot register a forbidden tool)
//   - workflow preflight (ReviewStep blocks publish on violation)
//   - future runtime adapter (HTTP DELETE blocked on every outbound call)
//
// Source of truth: knowledge/policies/no-deletion.md

import type { CatalogTool, Step } from "./types";

// Patterns that match any tool whose effect would delete or destroy data.
// Add to this list, never remove from it without a written admin override.
export const FORBIDDEN_PATTERNS: RegExp[] = [
  /\.delete(\.|$)/i,
  /\.remove(\.|$)/i,
  /\.purge(\.|$)/i,
  /\.destroy(\.|$)/i,
  /\.wipe(\.|$)/i,
  /\.erase(\.|$)/i,
];

// Forbidden HTTP verbs for any outbound call to ICE hosts.
export const FORBIDDEN_HTTP_METHODS = ["DELETE"] as const;

// Hosts that the no-deletion rule applies to.
export const PROTECTED_HOSTS = [
  "developer.icemortgagetechnology.com",
  "api.elliemae.com",
  "api.encompass.com",
  "encompass.com",
  "icemortgagetechnology.com",
  "elliemae.com",
];

export class ForbiddenOperationError extends Error {
  constructor(public readonly toolId: string, public readonly reason: string) {
    super(`[POLICY:no-deletion] "${toolId}" is forbidden: ${reason}`);
    this.name = "ForbiddenOperationError";
  }
}

/** Returns true if the given tool id violates the no-deletion policy. */
export function isForbiddenToolId(toolId: string): boolean {
  return FORBIDDEN_PATTERNS.some((p) => p.test(toolId));
}

/** Throws if the tool id is forbidden. Use as an assertion at boundaries. */
export function assertToolAllowed(toolId: string): void {
  if (isForbiddenToolId(toolId)) {
    throw new ForbiddenOperationError(
      toolId,
      "no-deletion policy bans delete/remove/purge/destroy/wipe/erase operations against Encompass."
    );
  }
}

/** Validate the catalog at module load. Refuse to ship a build that includes a forbidden tool. */
export function assertCatalogClean(catalog: CatalogTool[]): void {
  const offenders = catalog.filter((t) => isForbiddenToolId(t.id));
  if (offenders.length > 0) {
    throw new Error(
      `[POLICY:no-deletion] catalog contains forbidden tools: ${offenders.map((t) => t.id).join(", ")}\n` +
      `See knowledge/policies/no-deletion.md`
    );
  }
}

export interface PolicyViolation {
  policyId: "policy-no-deletion";
  severity: "critical";
  stepId: string;
  toolId: string;
  reason: string;
}

/** Scan a workflow's steps. Returns every violation found. */
export function findPolicyViolations(steps: Step[]): PolicyViolation[] {
  const violations: PolicyViolation[] = [];
  for (const step of steps) {
    if (isForbiddenToolId(step.use)) {
      violations.push({
        policyId: "policy-no-deletion",
        severity: "critical",
        stepId: step.id,
        toolId: step.use,
        reason: "Tool matches a forbidden delete/destroy pattern.",
      });
    }
  }
  return violations;
}

/** Filter a tool list down to only allowed tools. Used for the AI tool-use whitelist. */
export function filterAllowedTools<T extends { id: string }>(tools: T[]): T[] {
  return tools.filter((t) => !isForbiddenToolId(t.id));
}
