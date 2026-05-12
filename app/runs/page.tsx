"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, XCircle, Loader2, UserCheck, ChevronRight } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { listRuns } from "@/lib/storage";
import type { Run } from "@/lib/types";
import { cls, fmtDuration, timeAgo } from "@/lib/utils";

const STATUS = {
  succeeded:      { icon: CheckCircle2, chip: "chip-green",  label: "Succeeded" },
  failed:         { icon: XCircle,      chip: "chip-red",    label: "Failed" },
  running:        { icon: Loader2,      chip: "chip-brand",  label: "Running" },
  awaiting_human: { icon: UserCheck,    chip: "chip-amber",  label: "Awaiting human" },
} as const;

export default function RunsPage() {
  const [runs, setRuns] = useState<Run[]>([]);
  useEffect(() => { setRuns(listRuns()); }, []);

  return (
    <AppShell title="Runs" subtitle="Every execution of every workflow, with audit and replay">
      <div className="max-w-5xl mx-auto p-8">
        <div className="card overflow-hidden">
          <div className="grid grid-cols-12 px-5 py-3 border-b border-ink-200 bg-ink-50 text-[11px] font-semibold uppercase tracking-wide text-ink-600">
            <div className="col-span-4">Workflow</div>
            <div className="col-span-2">Loan</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-2">Duration</div>
            <div className="col-span-2 text-right">Started</div>
          </div>
          <div className="divide-y divide-ink-200">
            {runs.length === 0 && (
              <div className="p-8 text-center text-sm text-ink-500">No runs yet.</div>
            )}
            {runs.map((run) => {
              const s = STATUS[run.status];
              const Icon = s.icon;
              return (
                <Link
                  key={run.id}
                  href={`/workflows/${run.workflowId}`}
                  className="grid grid-cols-12 px-5 py-3.5 items-center hover:bg-ink-50 transition-colors group"
                >
                  <div className="col-span-4 min-w-0">
                    <div className="text-sm font-medium text-ink-900 truncate group-hover:text-brand-700">{run.workflowName}</div>
                    <div className="text-[11px] text-ink-400 font-mono truncate">{run.id}</div>
                  </div>
                  <div className="col-span-2 text-xs font-mono text-ink-600 truncate">{run.loanRef ?? "—"}</div>
                  <div className="col-span-2">
                    <span className={cls(s.chip, "inline-flex items-center gap-1.5")}>
                      <Icon className={cls("w-3 h-3", run.status === "running" && "animate-spin")} />
                      {s.label}
                    </span>
                  </div>
                  <div className="col-span-2 text-xs text-ink-600">{fmtDuration(run.durationMs)}</div>
                  <div className="col-span-2 flex items-center justify-end gap-2 text-xs text-ink-500">
                    {timeAgo(run.startedAt)}
                    <ChevronRight className="w-4 h-4 text-ink-300 group-hover:text-ink-700" />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
