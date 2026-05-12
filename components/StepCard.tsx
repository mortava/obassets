"use client";

import { ChevronUp, ChevronDown, Trash2, Copy, Database, Sparkles, UserCheck, Bell, GitFork, Wand2 } from "lucide-react";
import type { Step, Trigger } from "@/lib/types";
import { CATALOG_BY_ID } from "@/lib/catalog";
import { cls } from "@/lib/utils";

const CATEGORY_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  ice: Database,
  ai: Sparkles,
  human: UserCheck,
  notify: Bell,
  flow: GitFork,
  data: Wand2,
};

const CATEGORY_STYLE: Record<string, { iconBg: string; chip: string; ring: string }> = {
  ice:    { iconBg: "bg-ink-900 text-white",     chip: "chip-gray",  ring: "ring-ink-200" },
  ai:     { iconBg: "bg-ai-600 text-white",      chip: "chip-ai",    ring: "ring-ai-200" },
  human:  { iconBg: "bg-amber-500 text-white",   chip: "chip-amber", ring: "ring-amber-200" },
  notify: { iconBg: "bg-blue-600 text-white",    chip: "chip-brand", ring: "ring-blue-200" },
  flow:   { iconBg: "bg-ink-700 text-white",     chip: "chip-gray",  ring: "ring-ink-200" },
  data:   { iconBg: "bg-ink-500 text-white",     chip: "chip-gray",  ring: "ring-ink-200" },
};

export function StepCard({
  step,
  index,
  selected,
  onSelect,
  onMoveUp,
  onMoveDown,
  onDelete,
  onDuplicate,
  canUp,
  canDown,
}: {
  step: Step;
  index: number;
  selected: boolean;
  onSelect: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  canUp: boolean;
  canDown: boolean;
}) {
  const tool = CATALOG_BY_ID[step.use];
  const category = tool?.category ?? "ice";
  const Icon = CATEGORY_ICON[category];
  const style = CATEGORY_STYLE[category];

  const summary = summarizeStep(step);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cls(
        "w-full text-left card p-4 transition-all",
        selected ? "ring-2 ring-brand-500 shadow-soft" : "hover:shadow-soft"
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cls("w-9 h-9 rounded-lg grid place-items-center shrink-0", style.iconBg)}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[11px] text-ink-400 font-mono">{String(index + 1).padStart(2, "0")}</span>
            <span className="text-sm font-semibold text-ink-900 truncate">
              {tool?.label ?? step.use}
            </span>
            <span className={style.chip}>{step.id}</span>
          </div>
          <p className="text-xs text-ink-500 line-clamp-1">
            {summary || tool?.description || "Click to configure"}
          </p>
        </div>

        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
          <IconButton title="Move up" disabled={!canUp} onClick={onMoveUp}><ChevronUp className="w-3.5 h-3.5" /></IconButton>
          <IconButton title="Move down" disabled={!canDown} onClick={onMoveDown}><ChevronDown className="w-3.5 h-3.5" /></IconButton>
          <IconButton title="Duplicate" onClick={onDuplicate}><Copy className="w-3.5 h-3.5" /></IconButton>
          <IconButton title="Delete" onClick={onDelete}><Trash2 className="w-3.5 h-3.5" /></IconButton>
        </div>
      </div>
    </button>
  );
}

function IconButton({ children, title, onClick, disabled }: { children: React.ReactNode; title: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className="w-7 h-7 rounded-md grid place-items-center text-ink-500 hover:bg-ink-100 hover:text-ink-800 disabled:opacity-30 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}

function summarizeStep(step: Step): string {
  const w = step.with || {};
  const parts: string[] = [];
  for (const [k, v] of Object.entries(w)) {
    if (v === undefined || v === null || v === "") continue;
    const display = typeof v === "string" ? v : JSON.stringify(v);
    parts.push(`${k}: ${display}`);
    if (parts.join(" · ").length > 80) break;
  }
  return parts.join(" · ");
}

export function TriggerSummaryCard({ trigger }: { trigger: Trigger }) {
  return (
    <div className="card p-4 border-dashed border-2 border-brand-200 bg-brand-50/40">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg grid place-items-center bg-brand-600 text-white shrink-0">
          <Sparkles className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-wide text-brand-700 font-semibold mb-0.5">Trigger</div>
          <div className="text-sm font-semibold text-ink-900">{describeTrigger(trigger)}</div>
        </div>
      </div>
    </div>
  );
}

function describeTrigger(t: Trigger): string {
  switch (t.source) {
    case "encompass.field_change":
      return `When ${t.field || "a field"} ${t.op || "changes"}${t.value !== undefined && t.op !== "changes" && t.op !== "exists" ? ` ${t.value}` : ""}`;
    case "encompass.milestone":
      return `When milestone "${t.milestone || "?"}" is ${t.event || "completed"}`;
    case "encompass.document":
      return `When a document is ${t.event || "added"}${t.docType ? ` (type: ${t.docType})` : ""}`;
    case "encompass.webhook":
      return `On ${t.resource || "loan"} · ${(t.events || []).join(", ") || "any event"}`;
    case "schedule":
      return `On schedule: ${t.cron || "?"} (${t.tz || "UTC"})`;
    case "manual":
      return "Run manually from console or REST API";
    default:
      return "Trigger";
  }
}
