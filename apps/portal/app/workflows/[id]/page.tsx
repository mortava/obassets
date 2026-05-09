"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Pause, Play, Trash2, Activity, CheckCircle2, XCircle, UserCheck, Loader2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { FlowCanvas } from "@/components/FlowCanvas";
import { YamlPreview } from "@/components/YamlPreview";
import { getWorkflow, listRuns, saveWorkflow, deleteWorkflow } from "@/lib/storage";
import type { Workflow, Run } from "@/lib/types";
import { cls, fmtDuration, fmtNum, fmtPct, timeAgo } from "@/lib/utils";

const RUN_STATUS = {
  succeeded:      { icon: CheckCircle2, chip: "chip-green",  label: "Succeeded" },
  failed:         { icon: XCircle,      chip: "chip-red",    label: "Failed" },
  running:        { icon: Loader2,      chip: "chip-brand",  label: "Running" },
  awaiting_human: { icon: UserCheck,    chip: "chip-amber",  label: "Awaiting human" },
} as const;

const STATUS_CHIP = {
  draft:  "chip-gray",
  live:   "chip-green",
  paused: "chip-amber",
  error:  "chip-red",
} as const;

export default function WorkflowDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [tab, setTab] = useState<"flow" | "yaml" | "runs">("flow");

  useEffect(() => {
    const w = getWorkflow(params.id);
    if (!w) {
      router.replace("/");
      return;
    }
    setWorkflow(w);
    setRuns(listRuns().filter((r) => r.workflowId === w.id));
  }, [params.id, router]);

  if (!workflow) return null;

  const togglePause = () => {
    const next: Workflow = { ...workflow, status: workflow.status === "live" ? "paused" : "live" };
    saveWorkflow(next);
    setWorkflow(next);
  };

  const remove = () => {
    if (!confirm(`Delete "${workflow.name}"? This cannot be undone.`)) return;
    deleteWorkflow(workflow.id);
    router.push("/");
  };

  return (
    <AppShell
      title={workflow.name}
      subtitle={workflow.description}
      action={
        <div className="flex items-center gap-2">
          <button onClick={togglePause} className="btn-secondary h-9">
            {workflow.status === "live" ? <><Pause className="w-4 h-4" /> Pause</> : <><Play className="w-4 h-4" /> Activate</>}
          </button>
          <button onClick={remove} className="btn-ghost h-9 text-red-600 hover:bg-red-50">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      }
    >
      <div className="max-w-6xl mx-auto p-8">
        {/* Header strip */}
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <span className={cls(STATUS_CHIP[workflow.status], "text-xs")}>● {workflow.status}</span>
          <span className="chip-gray uppercase">{workflow.env}</span>
          <span className="text-xs text-ink-500">Updated {timeAgo(workflow.updatedAt)}</span>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <Kpi icon={<Activity className="w-4 h-4" />} label="Runs (30d)" value={fmtNum(workflow.runs)} />
          <Kpi icon={<CheckCircle2 className="w-4 h-4" />} label="Success rate" value={fmtPct(workflow.successRate)} />
          <Kpi icon={<Loader2 className="w-4 h-4" />} label="Last run" value={timeAgo(workflow.lastRunAt)} />
        </div>

        {/* Tabs */}
        <div className="border-b border-ink-200 mb-4">
          <nav className="-mb-px flex gap-6">
            <TabButton active={tab === "flow"} onClick={() => setTab("flow")}>Visual flow</TabButton>
            <TabButton active={tab === "yaml"} onClick={() => setTab("yaml")}>YAML</TabButton>
            <TabButton active={tab === "runs"} onClick={() => setTab("runs")}>Runs ({runs.length})</TabButton>
          </nav>
        </div>

        {tab === "flow" && (
          <div className="card overflow-hidden h-[60vh]">
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
        )}

        {tab === "yaml" && (
          <div className="h-[60vh]">
            <YamlPreview workflow={workflow} />
          </div>
        )}

        {tab === "runs" && (
          <div className="card overflow-hidden">
            <div className="grid grid-cols-12 px-4 py-2.5 border-b border-ink-200 bg-ink-50 text-[11px] font-semibold uppercase tracking-wide text-ink-600">
              <div className="col-span-4">Run</div>
              <div className="col-span-2">Loan</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-2">Duration</div>
              <div className="col-span-2 text-right">Started</div>
            </div>
            <div className="divide-y divide-ink-200">
              {runs.length === 0 && <div className="p-8 text-center text-sm text-ink-500">No runs yet.</div>}
              {runs.map((run) => {
                const s = RUN_STATUS[run.status];
                const Icon = s.icon;
                return (
                  <div key={run.id} className="grid grid-cols-12 px-4 py-3 items-center">
                    <div className="col-span-4 font-mono text-xs text-ink-700">{run.id}</div>
                    <div className="col-span-2 font-mono text-xs text-ink-600">{run.loanRef ?? "—"}</div>
                    <div className="col-span-2">
                      <span className={cls(s.chip, "inline-flex items-center gap-1.5")}>
                        <Icon className={cls("w-3 h-3", run.status === "running" && "animate-spin")} />
                        {s.label}
                      </span>
                    </div>
                    <div className="col-span-2 text-xs text-ink-600">{fmtDuration(run.durationMs)}</div>
                    <div className="col-span-2 text-right text-xs text-ink-500">{timeAgo(run.startedAt)}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-8">
          <Link href="/new" className="text-sm text-brand-700 underline underline-offset-2">
            Build another workflow →
          </Link>
        </div>
      </div>
    </AppShell>
  );
}

function Kpi({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between text-xs text-ink-500 mb-2">
        <span>{label}</span>
        <span className="text-ink-700">{icon}</span>
      </div>
      <div className="text-xl font-semibold text-ink-900">{value}</div>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cls(
        "py-2.5 px-1 text-sm border-b-2 transition-colors",
        active ? "border-ink-900 text-ink-900 font-medium" : "border-transparent text-ink-500 hover:text-ink-800"
      )}
    >
      {children}
    </button>
  );
}
