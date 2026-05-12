"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Workflow, Activity, Plug, LayoutGrid, Settings, Sparkles, ShieldCheck } from "lucide-react";
import { cls } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Workflows", icon: Workflow },
  { href: "/runs", label: "Runs", icon: Activity },
  { href: "/connections", label: "Connections", icon: Plug },
  { href: "/templates", label: "Templates", icon: LayoutGrid },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden md:flex md:flex-col w-60 shrink-0 border-r border-ink-200 bg-white">
      <div className="h-14 px-5 flex items-center gap-2 border-b border-ink-200">
        <div className="w-7 h-7 rounded-lg bg-ink-900 text-white grid place-items-center">
          <Sparkles className="w-4 h-4" />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold text-ink-900">OpenBroker</div>
          <div className="text-[11px] text-ink-500">AI workflow portal</div>
        </div>
      </div>
      <nav className="p-3 space-y-1">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cls(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-ink-900 text-white"
                  : "text-ink-700 hover:bg-ink-100"
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto p-3 space-y-2">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
          <div className="flex items-center gap-1.5 font-medium mb-1">
            <ShieldCheck className="w-3.5 h-3.5" />
            No-deletion guardrail
          </div>
          The platform will never delete data in Encompass. Enforced at every layer.
        </div>
        <div className="rounded-xl border border-ink-200 bg-ink-50 p-3 text-xs text-ink-600">
          <div className="font-medium text-ink-800 mb-1">Sandbox mode</div>
          Workflows run against the Encompass sandbox environment until you switch to production.
        </div>
      </div>
    </aside>
  );
}
