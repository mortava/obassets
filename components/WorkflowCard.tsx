"use client";

import Link from "next/link";
import { Activity, Clock, GitBranch } from "lucide-react";
import type { Workflow } from "@/lib/types";
import { fmtNum, fmtPct, timeAgo, cls } from "@/lib/utils";

const STATUS_CHIP: Record<Workflow["status"], string> = {
  draft: "chip-gray",
  live: "chip-green",
  paused: "chip-amber",
  error: "chip-red",
};

const STATUS_LABEL: Record<Workflow["status"], string> = {
  draft: "Draft",
  live: "Live",
  paused: "Paused",
  error: "Error",
};

export function WorkflowCard({ workflow }: { workflow: Workflow }) {
  return (
    <Link
      href={`/workflows/${workflow.id}`}
      className="card p-5 hover:shadow-soft transition-shadow group block"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={STATUS_CHIP[workflow.status]}>● {STATUS_LABEL[workflow.status]}</span>
            <span className="chip-gray uppercase tracking-wide">{workflow.env}</span>
          </div>
          <h3 className="text-[15px] font-semibold text-ink-900 truncate group-hover:text-brand-700 transition-colors">
            {workflow.name}
          </h3>
        </div>
      </div>
      <p className="text-[13px] text-ink-600 line-clamp-2 mb-4 min-h-[36px]">
        {workflow.description}
      </p>
      <div className="grid grid-cols-3 gap-3 text-xs">
        <Stat icon={<Activity className="w-3.5 h-3.5" />} label="Runs (30d)" value={fmtNum(workflow.runs)} />
        <Stat icon={<GitBranch className="w-3.5 h-3.5" />} label="Success" value={fmtPct(workflow.successRate)} />
        <Stat icon={<Clock className="w-3.5 h-3.5" />} label="Last run" value={timeAgo(workflow.lastRunAt)} />
      </div>
    </Link>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-ink-500 mb-0.5">
        {icon}
        <span>{label}</span>
      </div>
      <div className={cls("font-semibold text-ink-900", value === "—" || value === "never" ? "text-ink-400" : "")}>
        {value}
      </div>
    </div>
  );
}
