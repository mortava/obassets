"use client";

import { Check } from "lucide-react";
import { cls } from "@/lib/utils";
import type { WizardStepId } from "@/lib/types";

export interface StepperItem {
  id: WizardStepId;
  label: string;
  hint: string;
}

export function Stepper({
  steps,
  current,
  onJump,
}: {
  steps: StepperItem[];
  current: WizardStepId;
  onJump: (id: WizardStepId) => void;
}) {
  const idx = steps.findIndex((s) => s.id === current);
  return (
    <ol className="flex items-center gap-1 w-full overflow-x-auto py-2">
      {steps.map((s, i) => {
        const status: "done" | "current" | "todo" =
          i < idx ? "done" : i === idx ? "current" : "todo";
        const clickable = i <= idx;
        return (
          <li key={s.id} className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => clickable && onJump(s.id)}
              disabled={!clickable}
              className={cls(
                "flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                status === "done" && "text-emerald-700 hover:bg-emerald-50",
                status === "current" && "bg-ink-900 text-white",
                status === "todo" && "text-ink-400"
              )}
            >
              <span
                className={cls(
                  "w-5 h-5 rounded-full grid place-items-center text-[11px] font-semibold",
                  status === "done" && "bg-emerald-100 text-emerald-700",
                  status === "current" && "bg-white/15 text-white",
                  status === "todo" && "bg-ink-100 text-ink-500"
                )}
              >
                {status === "done" ? <Check className="w-3 h-3" /> : i + 1}
              </span>
              {s.label}
            </button>
            {i < steps.length - 1 && (
              <span className={cls("h-px w-6 bg-ink-200")} aria-hidden />
            )}
          </li>
        );
      })}
    </ol>
  );
}

export const WIZARD_STEPS: StepperItem[] = [
  { id: "goal",    label: "Goal",     hint: "What does this workflow accomplish?" },
  { id: "trigger", label: "Trigger",  hint: "When should it start?" },
  { id: "flow",    label: "Flow",     hint: "Drop in steps and AI building blocks" },
  { id: "connect", label: "Connect",  hint: "Make sure required systems are linked" },
  { id: "review",  label: "Review",   hint: "Preview the plan and the YAML" },
  { id: "publish", label: "Publish",  hint: "Activate in sandbox or production" },
];
