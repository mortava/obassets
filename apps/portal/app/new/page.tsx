"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Stepper, WIZARD_STEPS } from "@/components/Stepper";
import { GoalStep } from "@/components/wizard/GoalStep";
import { TriggerStep } from "@/components/wizard/TriggerStep";
import { FlowStep } from "@/components/wizard/FlowStep";
import { ConnectStep } from "@/components/wizard/ConnectStep";
import { ReviewStep } from "@/components/wizard/ReviewStep";
import { PublishStep } from "@/components/wizard/PublishStep";
import type { Workflow, WizardStepId } from "@/lib/types";
import { newId } from "@/lib/utils";

const INITIAL: Workflow = {
  id: newId("wf"),
  name: "",
  description: "",
  status: "draft",
  env: "sandbox",
  trigger: { source: "encompass.field_change", op: "equals" },
  steps: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  runs: 0,
  successRate: 0,
  lastRunAt: null,
};

export default function NewWorkflowPage() {
  const router = useRouter();
  const [step, setStep] = useState<WizardStepId>("goal");
  const [workflow, setWorkflow] = useState<Workflow>(INITIAL);

  function next(id: WizardStepId) { setStep(id); }
  const current = WIZARD_STEPS.find((s) => s.id === step)!;

  return (
    <AppShell title="New workflow" subtitle={current.hint}>
      <div className="max-w-5xl mx-auto p-8">
        <div className="mb-6">
          <Stepper steps={WIZARD_STEPS} current={step} onJump={setStep} />
        </div>

        <div className="card p-6">
          {step === "goal" && (
            <GoalStep
              workflow={workflow}
              onChange={setWorkflow}
              onNext={() => next("trigger")}
            />
          )}

          {step === "trigger" && (
            <TriggerStep
              workflow={workflow}
              onChange={setWorkflow}
              onBack={() => next("goal")}
              onNext={() => next("flow")}
            />
          )}

          {step === "flow" && (
            <FlowStep
              workflow={workflow}
              onChange={setWorkflow}
              onBack={() => next("trigger")}
              onNext={() => next("connect")}
            />
          )}

          {step === "connect" && (
            <ConnectStep
              workflow={workflow}
              onBack={() => next("flow")}
              onNext={() => next("review")}
            />
          )}

          {step === "review" && (
            <ReviewStep
              workflow={workflow}
              onBack={() => next("connect")}
              onNext={() => next("publish")}
            />
          )}

          {step === "publish" && (
            <PublishStep
              workflow={workflow}
              onChange={setWorkflow}
              onBack={() => next("review")}
              onPublished={() => router.push("/")}
            />
          )}
        </div>
      </div>
    </AppShell>
  );
}
