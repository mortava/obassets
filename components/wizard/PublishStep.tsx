"use client";

import { useState } from "react";
import Link from "next/link";
import { Rocket, CheckCircle2, FlaskConical, ShieldAlert } from "lucide-react";
import type { Workflow, Env } from "@/lib/types";
import { saveWorkflow } from "@/lib/storage";
import { cls } from "@/lib/utils";

export function PublishStep({
  workflow,
  onChange,
  onBack,
  onPublished,
}: {
  workflow: Workflow;
  onChange: (next: Workflow) => void;
  onBack: () => void;
  onPublished: () => void;
}) {
  const [activated, setActivated] = useState(false);

  function activate(env: Env) {
    const updated: Workflow = { ...workflow, env, status: "live" };
    saveWorkflow(updated);
    setActivated(true);
    setTimeout(onPublished, 800);
  }

  function saveDraft() {
    saveWorkflow({ ...workflow, status: "draft" });
    onPublished();
  }

  if (activated) {
    return (
      <div className="text-center py-16">
        <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 grid place-items-center mx-auto mb-4">
          <CheckCircle2 className="w-7 h-7" />
        </div>
        <h3 className="text-lg font-semibold text-ink-900 mb-1">Workflow is live</h3>
        <p className="text-sm text-ink-500">Redirecting to your dashboard…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="text-center">
        <div className="w-12 h-12 rounded-xl bg-brand-50 text-brand-600 grid place-items-center mx-auto mb-3">
          <Rocket className="w-5 h-5" />
        </div>
        <h3 className="text-lg font-semibold text-ink-900">Ready to publish</h3>
        <p className="text-sm text-ink-500">Pick where this workflow should run.</p>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <EnvCard
          env="sandbox"
          title="Activate in sandbox"
          description="Runs against the Encompass sandbox. Safe to test end-to-end."
          icon={<FlaskConical className="w-5 h-5" />}
          recommended
          onClick={() => activate("sandbox")}
        />
        <EnvCard
          env="production"
          title="Activate in production"
          description="Runs against the live Encompass tenant. Real loans, real side effects."
          icon={<ShieldAlert className="w-5 h-5" />}
          onClick={() => activate("production")}
        />
      </div>

      <div className="card p-4 flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-ink-900">Not ready yet?</div>
          <div className="text-xs text-ink-500">Save as a draft and come back to it later.</div>
        </div>
        <button onClick={saveDraft} className="btn-secondary">Save as draft</button>
      </div>

      <div className="flex justify-between pt-2">
        <button className="btn-ghost" onClick={onBack}>← Back</button>
        <Link href="/" className="btn-ghost">Cancel</Link>
      </div>
    </div>
  );
}

function EnvCard({
  title,
  description,
  icon,
  recommended,
  onClick,
}: {
  env: Env;
  title: string;
  description: string;
  icon: React.ReactNode;
  recommended?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cls(
        "card p-5 text-left transition-all hover:shadow-soft hover:-translate-y-0.5",
        recommended && "ring-1 ring-brand-200"
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <span className={cls("w-10 h-10 rounded-lg grid place-items-center",
          recommended ? "bg-brand-50 text-brand-700" : "bg-ink-100 text-ink-700")}>
          {icon}
        </span>
        {recommended && <span className="chip-brand">Recommended</span>}
      </div>
      <div className="text-sm font-semibold text-ink-900">{title}</div>
      <p className="text-xs text-ink-500 mt-1">{description}</p>
    </button>
  );
}
