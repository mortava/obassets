"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, AlertCircle, Plug, ExternalLink } from "lucide-react";
import type { Workflow, Connection } from "@/lib/types";
import { listConnections, setConnection } from "@/lib/storage";
import { CONNECTION_DEFS, CATALOG_BY_ID } from "@/lib/catalog";
import { cls } from "@/lib/utils";

export function ConnectStep({
  workflow,
  onBack,
  onNext,
}: {
  workflow: Workflow;
  onBack: () => void;
  onNext: () => void;
}) {
  const [connections, setConnections] = useState<Connection[]>([]);

  useEffect(() => {
    setConnections(listConnections());
  }, []);

  // Determine which integrations are required by this workflow's steps.
  const required = new Set<string>(["encompass"]);
  for (const step of workflow.steps) {
    const tool = CATALOG_BY_ID[step.use];
    if (!tool) continue;
    if (tool.category === "ai") required.add("anthropic");
    if (tool.id === "notify.slack") required.add("slack");
    if (tool.id === "notify.email") required.add("email");
  }

  const status = CONNECTION_DEFS.map((def) => {
    const conn = connections.find((c) => c.id === def.id);
    const isRequired = required.has(def.id);
    return { def, conn, isRequired };
  });

  const allReadyForRequired = status.every((s) => !s.isRequired || s.conn?.connected);

  function toggleConnect(id: Connection["id"]) {
    const existing = connections.find((c) => c.id === id);
    const next: Connection = existing?.connected
      ? { id, connected: false }
      : {
          id,
          connected: true,
          connectedAt: new Date().toISOString(),
          account: id === "encompass" ? "Acme Lending (sandbox)" : id === "anthropic" ? "team-key" : "Demo workspace",
          env: id === "encompass" ? "sandbox" : undefined,
        };
    setConnection(next);
    setConnections(listConnections());
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-ink-900 mb-1">Connect the systems this workflow needs</h3>
        <p className="text-xs text-ink-500">
          Required connections are marked. You can add more from <Link href="/connections" className="text-brand-700 underline underline-offset-2">Connections</Link>.
        </p>
      </div>

      <div className="card divide-y divide-ink-200">
        {status.map(({ def, conn, isRequired }) => {
          const ok = !!conn?.connected;
          return (
            <div key={def.id} className="p-4 flex items-start gap-4">
              <div className={cls(
                "w-10 h-10 rounded-lg grid place-items-center shrink-0",
                ok ? "bg-emerald-50 text-emerald-700" : isRequired ? "bg-amber-50 text-amber-700" : "bg-ink-100 text-ink-500"
              )}>
                {ok ? <CheckCircle2 className="w-5 h-5" /> : isRequired ? <AlertCircle className="w-5 h-5" /> : <Plug className="w-5 h-5" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <div className="text-sm font-semibold text-ink-900">{def.name}</div>
                  {isRequired && !ok && <span className="chip-amber">Required</span>}
                  {ok && <span className="chip-green">Connected</span>}
                </div>
                <p className="text-xs text-ink-500 mt-0.5">{def.description}</p>
                {conn?.account && (
                  <p className="text-[11px] text-ink-500 mt-1.5">Account: <span className="font-medium text-ink-700">{conn.account}</span>{conn.env ? ` · env: ${conn.env}` : ""}</p>
                )}
              </div>
              <button
                onClick={() => toggleConnect(def.id)}
                className={ok ? "btn-secondary" : "btn-primary"}
              >
                {ok ? "Disconnect" : (
                  <>
                    Connect
                    <ExternalLink className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>

      {!allReadyForRequired && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-900">
          Connect the required integrations above to continue. The workflow can be saved as a draft, but it will not run until everything is linked.
        </div>
      )}

      <div className="flex justify-between pt-2">
        <button className="btn-ghost" onClick={onBack}>← Back</button>
        <button className="btn-primary" onClick={onNext} disabled={!allReadyForRequired}>
          Continue to review →
        </button>
      </div>
    </div>
  );
}
