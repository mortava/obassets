"use client";

import { useState } from "react";
import { Database, Sparkles, UserCheck, Bell, GitFork, Wand2, X } from "lucide-react";
import { CATALOG, CATEGORY_META } from "@/lib/catalog";
import type { CatalogTool, StepCategory } from "@/lib/types";
import { cls } from "@/lib/utils";

const CATEGORY_ICON: Record<StepCategory, React.ComponentType<{ className?: string }>> = {
  ice: Database,
  ai: Sparkles,
  human: UserCheck,
  notify: Bell,
  flow: GitFork,
  data: Wand2,
};

export function StepPalette({
  onPick,
  onClose,
}: {
  onPick: (tool: CatalogTool) => void;
  onClose: () => void;
}) {
  const [active, setActive] = useState<StepCategory>("ice");
  const tools = CATALOG.filter((t) => t.category === active);

  const cats: StepCategory[] = ["ice", "ai", "human", "notify", "flow"];

  return (
    <div className="fixed inset-0 z-40 bg-ink-950/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(720px,92vw)] max-h-[80vh] bg-white rounded-2xl shadow-pop flex overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Categories */}
        <div className="w-56 shrink-0 border-r border-ink-200 bg-ink-50 p-3 space-y-1">
          <div className="px-2 pt-1 pb-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-ink-700">Add a step</span>
            <button onClick={onClose} className="text-ink-500 hover:text-ink-900"><X className="w-4 h-4" /></button>
          </div>
          {cats.map((c) => {
            const Icon = CATEGORY_ICON[c];
            const meta = CATEGORY_META[c];
            return (
              <button
                key={c}
                onClick={() => setActive(c)}
                className={cls(
                  "w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors text-left",
                  active === c ? "bg-white text-ink-900 shadow-card border border-ink-200" : "text-ink-600 hover:bg-white/60"
                )}
              >
                <Icon className="w-4 h-4" />
                <span className="font-medium">{meta.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tools */}
        <div className="flex-1 min-w-0 overflow-y-auto p-4">
          <p className="text-xs text-ink-500 mb-3">{CATEGORY_META[active].description}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {tools.map((t) => (
              <button
                key={t.id}
                onClick={() => onPick(t)}
                className="text-left p-3 rounded-xl border border-ink-200 hover:border-ink-300 hover:shadow-card bg-white transition-all"
              >
                <div className="text-sm font-semibold text-ink-900">{t.label}</div>
                <div className="text-xs text-ink-500 mt-0.5">{t.description}</div>
                <div className="text-[10px] font-mono text-ink-400 mt-1.5">{t.id}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
