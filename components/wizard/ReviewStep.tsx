"use client";

import { CheckCircle2, AlertTriangle, ShieldCheck, Eye, Code2 } from "lucide-react";
import { useState } from "react";
import type { Workflow } from "@/lib/types";
import { FlowCanvas } from "@/components/FlowCanvas";
import { YamlPreview } from "@/components/YamlPreview";
import { CATALOG_BY_ID } from "@/lib/catalog";
import { findPolicyViolations } from "@/lib/guardrails";
import { cls } from "@/lib/utils";

export function ReviewStep({
  workflow,
  onBack,
  onNext,
}: {
  workflow: Workflow;
  onBack: () => void;
  onNext: () => void;
}) {
  const [view, setView] = useState<"visual" | "yaml">("visual");
  const checks = runPreflight(workflow);
  const blocking = checks.filter((c) => c.level === "error");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-ink-900">Review your workflow</h3>
          <p className="text-xs text-ink-500">Visual on the left, the same workflow as YAML on the right.</p>
        </div>
        <div className="inline-flex rounded-lg border border-ink-200 p-0.5 bg-white">
          <button
            onClick={() => setView("visual")}
            className={cls("h-8 px-3 text-xs rounded-md inline-flex items-center gap-1.5",
              view === "visual" ? "bg-ink-900 text-white" : "text-ink-600 hover:bg-ink-50")}>
            <Eye className="w-3.5 h-3.5" /> Visual
          </button>
          <button
            onClick={() => setView("yaml")}
            className={cls("h-8 px-3 text-xs rounded-md inline-flex items-center gap-1.5",
              view === "yaml" ? "bg-ink-900 text-white" : "text-ink-600 hover:bg-ink-50")}>
            <Code2 className="w-3.5 h-3.5" /> YAML
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-[60vh]">
        <div className={cls("card overflow-hidden", view === "yaml" && "lg:hidden")}>
          <div className="h-full">
            <FlowCanvas
              trigger={workflow.trigger}
              steps={workflow.steps}
              selectedId={null}
              onSelect={() => {}}
              onMove={() => {}}
              onDelete={() => {}}
              onDuplicate={() => {}}
              onAddAt={() => {}}
            />
          </div>
        </div>
        <div className={cls(view === "visual" && "lg:block hidden lg:hidden", view === "yaml" && "block")}>
          <YamlPreview workflow={workflow} />
        </div>
        <div className={cls("hidden lg:block", view === "visual" ? "lg:block" : "lg:hidden")}>
          <YamlPreview workflow={workflow} />
        </div>
      </div>

      {/* Preflight checks */}
      <div className="card divide-y divide-ink-200">
        <div className="px-4 py-3 bg-ink-50 rounded-t-xl">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-ink-700" />
            <span className="text-xs font-semibold text-ink-800">Preflight checks</span>
          </div>
        </div>
        {checks.map((c, i) => (
          <CheckRow key={i} {...c} />
        ))}
      </div>

      <div className="flex justify-between pt-2">
        <button className="btn-ghost" onClick={onBack}>← Back</button>
        <button className="btn-primary" onClick={onNext} disabled={blocking.length > 0}>
          Continue to publish →
        </button>
      </div>
    </div>
  );
}

interface CheckResult { level: "ok" | "warn" | "error"; title: string; detail?: string }

function runPreflight(w: Workflow): CheckResult[] {
  const checks: CheckResult[] = [];

  // ── Critical policy: no deletion of Encompass data ──────────────────────
  // See knowledge/policies/no-deletion.md
  const violations = findPolicyViolations(w.steps);
  if (violations.length > 0) {
    for (const v of violations) {
      checks.push({
        level: "error",
        title: `Policy violation — step "${v.stepId}" uses forbidden operation "${v.toolId}"`,
        detail: `${v.reason} The no-deletion policy bans this. See knowledge/policies/no-deletion.md.`,
      });
    }
  } else {
    checks.push({
      level: "ok",
      title: "No-deletion policy: passes",
      detail: "Workflow contains no delete/remove/purge/destroy operations against Encompass.",
    });
  }

  if (w.steps.length === 0) {
    checks.push({ level: "error", title: "Workflow has no steps", detail: "Add at least one step before publishing." });
  } else {
    checks.push({ level: "ok", title: `${w.steps.length} step${w.steps.length === 1 ? "" : "s"} configured` });
  }

  // Side-effect-before-read warning
  const firstSideEffect = w.steps.findIndex((s) => isSideEffect(s.use));
  const firstRead = w.steps.findIndex((s) => isRead(s.use));
  if (firstSideEffect >= 0 && (firstRead < 0 || firstSideEffect < firstRead)) {
    checks.push({ level: "warn", title: "Side effect before any read", detail: "Best practice: pull loan data first, then act on it." });
  }

  // AI step without schema
  const aiNoSchema = w.steps.find((s) => CATALOG_BY_ID[s.use]?.category === "ai" && !s.with.output_schema);
  if (aiNoSchema) {
    checks.push({ level: "warn", title: `AI step "${aiNoSchema.id}" has no output schema`, detail: "Strong outputs reduce hallucination risk." });
  } else if (w.steps.some((s) => CATALOG_BY_ID[s.use]?.category === "ai")) {
    checks.push({ level: "ok", title: "AI steps have structured output schemas" });
  }

  // Human approval before destructive action
  const hasDestructive = w.steps.some((s) => DESTRUCTIVE.has(s.use));
  const hasHuman = w.steps.some((s) => s.use === "human.task.wait_approval");
  if (hasDestructive && !hasHuman) {
    checks.push({ level: "warn", title: "Destructive action without human approval", detail: "Consider adding a human approval step before sending docs or returning to broker." });
  } else if (hasDestructive && hasHuman) {
    checks.push({ level: "ok", title: "Destructive actions are gated by human approval" });
  }

  // PII redaction policy reminder
  if (w.steps.some((s) => CATALOG_BY_ID[s.use]?.category === "ai")) {
    checks.push({ level: "ok", title: "PII redaction policy will apply to AI steps automatically" });
  }

  return checks;
}

const DESTRUCTIVE = new Set([
  "edc.send_docs.opening",
  "edc.send_docs.closing",
  "edc.send_docs.on_demand",
  "edc.loan.conditions.create",
  "edc.loan.conditions.clear",
  "edc.loan.milestone.advance",
]);

function isSideEffect(use: string) {
  return /^edc\.(loan\.(field\.set|milestone|conditions|documents\.upload)|send_docs)/.test(use) || /^notify\./.test(use);
}
function isRead(use: string) {
  return /^edc\.(loan\.get|loan\.field\.get|loan\.documents\.list|loan\.documents\.download|loan\.conditions\.list|loan\.milestone\.list|pipeline)/.test(use);
}

function CheckRow({ level, title, detail }: CheckResult) {
  const ICON = { ok: CheckCircle2, warn: AlertTriangle, error: AlertTriangle }[level];
  const COLOR = {
    ok: "text-emerald-600 bg-emerald-50",
    warn: "text-amber-600 bg-amber-50",
    error: "text-red-600 bg-red-50",
  }[level];
  return (
    <div className="px-4 py-3 flex items-start gap-3">
      <span className={cls("w-7 h-7 rounded-md grid place-items-center shrink-0", COLOR)}>
        <ICON className="w-3.5 h-3.5" />
      </span>
      <div className="min-w-0">
        <div className="text-sm text-ink-900">{title}</div>
        {detail && <div className="text-xs text-ink-500 mt-0.5">{detail}</div>}
      </div>
    </div>
  );
}
