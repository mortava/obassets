"use client";

import { Webhook, GitCommitVertical, Flag, FileUp, CalendarClock, MousePointer2 } from "lucide-react";
import type { Trigger, TriggerSource, Workflow } from "@/lib/types";
import { cls } from "@/lib/utils";

interface TriggerOption {
  id: TriggerSource;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const TRIGGERS: TriggerOption[] = [
  { id: "encompass.field_change", label: "Field change",      description: "When a field on the loan changes (e.g. broker submits)", icon: GitCommitVertical },
  { id: "encompass.milestone",    label: "Milestone event",   description: "When a milestone is started, completed, or reverted",     icon: Flag },
  { id: "encompass.document",     label: "Document added",    description: "When a document is uploaded to the loan",                 icon: FileUp },
  { id: "encompass.webhook",      label: "Custom webhook",    description: "Subscribe to any EDC resource + event",                   icon: Webhook },
  { id: "schedule",               label: "On a schedule",     description: "Run on a cron schedule against a pipeline query",         icon: CalendarClock },
  { id: "manual",                 label: "Manual / API",      description: "Triggered from the console or via REST",                  icon: MousePointer2 },
];

export function TriggerStep({
  workflow,
  onChange,
  onBack,
  onNext,
}: {
  workflow: Workflow;
  onChange: (next: Workflow) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const t = workflow.trigger;
  const set = (patch: Partial<Trigger>) => onChange({ ...workflow, trigger: { ...t, ...patch } });

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-sm font-semibold text-ink-900 mb-1">Pick the event that starts this workflow</h3>
        <p className="text-xs text-ink-500 mb-4">A workflow runs once each time its trigger fires.</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {TRIGGERS.map((opt) => {
            const Icon = opt.icon;
            const picked = t.source === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => set({ source: opt.id })}
                className={cls(
                  "text-left p-4 rounded-xl border transition-all",
                  picked
                    ? "border-brand-600 bg-brand-50 ring-2 ring-brand-100"
                    : "border-ink-200 bg-white hover:border-ink-300 hover:shadow-card"
                )}
              >
                <div className="flex items-start gap-3">
                  <span className={cls("w-9 h-9 rounded-lg grid place-items-center shrink-0",
                    picked ? "bg-brand-600 text-white" : "bg-ink-100 text-ink-700")}>
                    <Icon className="w-4 h-4" />
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-ink-900">{opt.label}</div>
                    <div className="text-xs mt-0.5 text-ink-500">{opt.description}</div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Per-trigger config */}
      <div className="card p-5">
        <h4 className="text-sm font-semibold text-ink-900 mb-4">Configure trigger</h4>

        {t.source === "encompass.field_change" && (
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Field" help="Encompass field id (e.g. Loan.SubmittedToLender)">
              <input className="input" value={t.field || ""} onChange={(e) => set({ field: e.target.value })} placeholder="Loan.SubmittedToLender" />
            </Field>
            <Field label="Operator">
              <select className="input" value={t.op || "equals"} onChange={(e) => set({ op: e.target.value as Trigger["op"] })}>
                <option value="equals">equals</option>
                <option value="changes">changes</option>
                <option value="exists">exists</option>
                <option value="matches">matches</option>
              </select>
            </Field>
            {t.op !== "exists" && t.op !== "changes" && (
              <Field label="Value">
                <input className="input" value={String(t.value ?? "")} onChange={(e) => set({ value: e.target.value })} placeholder="true" />
              </Field>
            )}
            <Field label="Filter (optional)" help="CEL-like expression evaluated after fetching the loan.">
              <input className="input" value={t.filter || ""} onChange={(e) => set({ filter: e.target.value })} placeholder="loan.channel == 'Wholesale'" />
            </Field>
          </div>
        )}

        {t.source === "encompass.milestone" && (
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Milestone">
              <input className="input" value={t.milestone || ""} onChange={(e) => set({ milestone: e.target.value })} placeholder="Submittal" />
            </Field>
            <Field label="Event">
              <select className="input" value={t.event || "completed"} onChange={(e) => set({ event: e.target.value })}>
                <option value="started">started</option>
                <option value="completed">completed</option>
                <option value="reverted">reverted</option>
              </select>
            </Field>
          </div>
        )}

        {t.source === "encompass.document" && (
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Document type (optional)">
              <input className="input" value={t.docType || ""} onChange={(e) => set({ docType: e.target.value })} placeholder="UW Conditions" />
            </Field>
            <Field label="Event">
              <select className="input" value={t.event || "added"} onChange={(e) => set({ event: e.target.value })}>
                <option value="added">added</option>
                <option value="updated">updated</option>
              </select>
            </Field>
          </div>
        )}

        {t.source === "encompass.webhook" && (
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Resource">
              <select className="input" value={t.resource || "loan"} onChange={(e) => set({ resource: e.target.value })}>
                <option value="loan">loan</option>
                <option value="loan.fieldChange">loan.fieldChange</option>
                <option value="loan.milestone">loan.milestone</option>
                <option value="loan.documents">loan.documents</option>
                <option value="loan.conditions">loan.conditions</option>
                <option value="loan.services">loan.services</option>
              </select>
            </Field>
            <Field label="Events (comma-sep)">
              <input className="input" value={(t.events || []).join(", ")} onChange={(e) => set({ events: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })} placeholder="create, update" />
            </Field>
          </div>
        )}

        {t.source === "schedule" && (
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Cron" help="Standard 5-field cron, e.g. */30 * * * *">
              <input className="input font-mono" value={t.cron || ""} onChange={(e) => set({ cron: e.target.value })} placeholder="*/30 * * * *" />
            </Field>
            <Field label="Timezone">
              <input className="input" value={t.tz || "America/Los_Angeles"} onChange={(e) => set({ tz: e.target.value })} />
            </Field>
          </div>
        )}

        {t.source === "manual" && (
          <p className="text-sm text-ink-500">Manual workflows are run from the console or via the REST API. No additional config.</p>
        )}
      </div>

      <div className="flex justify-between pt-2">
        <button className="btn-ghost" onClick={onBack}>← Back</button>
        <button className="btn-primary" onClick={onNext}>Continue to flow →</button>
      </div>
    </div>
  );
}

function Field({ label, help, children }: { label: string; help?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
      {help && <p className="mt-1 text-[11px] text-ink-500">{help}</p>}
    </div>
  );
}
