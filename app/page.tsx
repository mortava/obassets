"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Sparkles, Activity, CheckCircle2, AlertTriangle } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { WorkflowCard } from "@/components/WorkflowCard";
import { listWorkflows, listRuns } from "@/lib/storage";
import type { Workflow, Run } from "@/lib/types";

export default function DashboardPage() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);

  useEffect(() => {
    setWorkflows(listWorkflows());
    setRuns(listRuns());
  }, []);

  const live = workflows.filter((w) => w.status === "live").length;
  const succeeded = runs.filter((r) => r.status === "succeeded").length;
  const failed = runs.filter((r) => r.status === "failed").length;
  const awaiting = runs.filter((r) => r.status === "awaiting_human").length;

  return (
    <AppShell title="Workflows" subtitle="Design and run AI workflows on Encompass and TPO Connect">
      <div className="max-w-6xl mx-auto p-8">
        {/* Hero / quick stats */}
        <section className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-8">
          <StatCard icon={<Sparkles className="w-4 h-4" />} label="Live workflows" value={String(live)} accent="brand" />
          <StatCard icon={<Activity className="w-4 h-4" />} label="Runs (24h)" value={String(runs.length)} accent="ink" />
          <StatCard icon={<CheckCircle2 className="w-4 h-4" />} label="Succeeded" value={String(succeeded)} accent="emerald" />
          <StatCard icon={<AlertTriangle className="w-4 h-4" />} label={awaiting ? "Awaiting human" : "Failures"} value={String(awaiting || failed)} accent={awaiting ? "amber" : "red"} />
        </section>

        {/* Workflows list */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-ink-900">Your workflows</h2>
              <p className="text-xs text-ink-500">Click a workflow to view runs, edit, or pause it.</p>
            </div>
            <Link href="/new" className="btn-primary h-9">
              <Plus className="w-4 h-4" />
              New workflow
            </Link>
          </div>

          {workflows.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {workflows.map((w) => (
                <WorkflowCard key={w.id} workflow={w} />
              ))}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}

function StatCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent: "brand" | "ink" | "emerald" | "amber" | "red";
}) {
  const ACCENT: Record<string, string> = {
    brand: "bg-brand-50 text-brand-700",
    ink: "bg-ink-100 text-ink-700",
    emerald: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    red: "bg-red-50 text-red-700",
  };
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-ink-500">{label}</span>
        <span className={`w-7 h-7 rounded-lg grid place-items-center ${ACCENT[accent]}`}>{icon}</span>
      </div>
      <div className="text-2xl font-semibold text-ink-900 mt-2">{value}</div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="card p-12 text-center">
      <div className="w-12 h-12 rounded-xl bg-brand-50 text-brand-600 grid place-items-center mx-auto mb-4">
        <Sparkles className="w-5 h-5" />
      </div>
      <h3 className="text-base font-semibold text-ink-900 mb-1">Build your first AI workflow</h3>
      <p className="text-sm text-ink-500 max-w-sm mx-auto mb-5">
        Pick a trigger from Encompass or TPO Connect, drop in a few steps, and let AI handle the rest.
      </p>
      <Link href="/new" className="btn-primary">
        <Plus className="w-4 h-4" />
        New workflow
      </Link>
    </div>
  );
}
