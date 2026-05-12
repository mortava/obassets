"use client";

import { useState } from "react";
import { ClipboardCheck, FileSearch, Timer, Plus } from "lucide-react";
import type { Workflow } from "@/lib/types";
import { STARTER_TEMPLATES } from "@/lib/samples";
import { newId, slug } from "@/lib/utils";
import { cls } from "@/lib/utils";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  ClipboardCheck, FileSearch, Timer, Plus,
};

export function GoalStep({
  workflow,
  onChange,
  onNext,
}: {
  workflow: Workflow;
  onChange: (next: Workflow) => void;
  onNext: () => void;
}) {
  const [pickedTemplateId, setPickedTemplateId] = useState<string | null>(null);

  function pickTemplate(tplId: string) {
    setPickedTemplateId(tplId);
    const tpl = STARTER_TEMPLATES.find((t) => t.id === tplId);
    if (!tpl) return;

    if (tpl.workflow) {
      // Clone template, give a fresh id, mark as draft.
      const clone: Workflow = {
        ...tpl.workflow,
        id: newId("wf"),
        status: "draft",
        env: "sandbox",
        runs: 0,
        successRate: 0,
        lastRunAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      onChange(clone);
    } else {
      onChange({
        ...workflow,
        name: workflow.name || "Untitled workflow",
        description: workflow.description || "",
        steps: [],
      });
    }
  }

  const canContinue = workflow.name.trim().length >= 3;

  return (
    <div className="space-y-8">
      <div>
        <label className="label">Workflow name</label>
        <input
          className="input text-base"
          placeholder="e.g. Auto-clear obvious income conditions"
          value={workflow.name}
          onChange={(e) => onChange({ ...workflow, name: e.target.value, id: workflow.id || slug(e.target.value) || newId("wf") })}
        />
      </div>

      <div>
        <label className="label">What does this workflow accomplish?</label>
        <textarea
          className="input min-h-[96px]"
          placeholder="One or two sentences. e.g. When a TPO broker submits a file, run AI triage and either return it with conditions or advance it to Setup."
          value={workflow.description}
          onChange={(e) => onChange({ ...workflow, description: e.target.value })}
        />
        <p className="mt-2 text-xs text-ink-500">
          This is shown on the dashboard and used as context for AI steps.
        </p>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold text-ink-900">Start from a template</h3>
            <p className="text-xs text-ink-500">Optional. Pre-fills the trigger and steps; you can edit everything afterwards.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {STARTER_TEMPLATES.map((tpl) => {
            const Icon = ICONS[tpl.icon] ?? Plus;
            const picked = pickedTemplateId === tpl.id;
            return (
              <button
                key={tpl.id}
                type="button"
                onClick={() => pickTemplate(tpl.id)}
                className={cls(
                  "text-left p-4 rounded-xl border transition-all",
                  picked
                    ? "border-ink-900 bg-ink-900 text-white shadow-soft"
                    : "border-ink-200 bg-white hover:border-ink-300 hover:shadow-card"
                )}
              >
                <div className="flex items-start gap-3">
                  <span className={cls("w-9 h-9 rounded-lg grid place-items-center shrink-0", picked ? "bg-white/15 text-white" : "bg-ink-100 text-ink-700")}>
                    <Icon className="w-4 h-4" />
                  </span>
                  <div className="min-w-0">
                    <div className={cls("text-sm font-semibold", picked ? "text-white" : "text-ink-900")}>{tpl.name}</div>
                    <div className={cls("text-xs mt-0.5", picked ? "text-white/70" : "text-ink-500")}>{tpl.summary}</div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <button className="btn-primary" disabled={!canContinue} onClick={onNext}>
          Continue to trigger →
        </button>
      </div>
    </div>
  );
}
