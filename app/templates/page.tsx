"use client";

import Link from "next/link";
import { ClipboardCheck, FileSearch, Timer, Plus } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { STARTER_TEMPLATES } from "@/lib/samples";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  ClipboardCheck, FileSearch, Timer, Plus,
};

export default function TemplatesPage() {
  return (
    <AppShell title="Templates" subtitle="Start from a proven mortgage workflow">
      <div className="max-w-4xl mx-auto p-8">
        <div className="grid sm:grid-cols-2 gap-4">
          {STARTER_TEMPLATES.map((tpl) => {
            const Icon = ICONS[tpl.icon] ?? Plus;
            return (
              <Link
                key={tpl.id}
                href="/new"
                className="card p-5 hover:shadow-soft transition-all group"
              >
                <div className="flex items-start gap-3 mb-3">
                  <span className="w-10 h-10 rounded-lg bg-ink-100 text-ink-700 grid place-items-center group-hover:bg-ink-900 group-hover:text-white transition-colors">
                    <Icon className="w-5 h-5" />
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-ink-900">{tpl.name}</div>
                    <div className="text-xs text-ink-500 mt-0.5">{tpl.summary}</div>
                  </div>
                </div>
                {tpl.workflow && (
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span className="chip-gray">{tpl.workflow.steps.length} steps</span>
                    <span className="chip-gray">trigger: {tpl.workflow.trigger.source.split(".").pop()}</span>
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
