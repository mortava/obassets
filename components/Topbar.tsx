"use client";

import Link from "next/link";
import { Plus, Search } from "lucide-react";

export function Topbar({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <header className="h-14 shrink-0 border-b border-ink-200 bg-white flex items-center px-6 gap-4">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-ink-900 truncate">{title}</div>
        {subtitle && <div className="text-xs text-ink-500 truncate">{subtitle}</div>}
      </div>
      <div className="hidden md:flex items-center gap-2 max-w-sm flex-1">
        <div className="relative w-full">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
          <input
            placeholder="Search workflows, runs, loans…"
            className="input pl-8 h-9"
          />
        </div>
      </div>
      {action ?? (
        <Link href="/new" className="btn-primary h-9 px-3">
          <Plus className="w-4 h-4" />
          New workflow
        </Link>
      )}
    </header>
  );
}
