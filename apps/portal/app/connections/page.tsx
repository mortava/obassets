"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, AlertCircle, Plug, ExternalLink, KeyRound, Webhook } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { listConnections, setConnection } from "@/lib/storage";
import { CONNECTION_DEFS } from "@/lib/catalog";
import type { Connection } from "@/lib/types";
import { cls, timeAgo } from "@/lib/utils";

const AUTH_ICON = {
  oauth: ExternalLink,
  "api-key": KeyRound,
  webhook: Webhook,
} as const;

export default function ConnectionsPage() {
  const [connections, setConnections] = useState<Connection[]>([]);

  useEffect(() => {
    setConnections(listConnections());
  }, []);

  function toggle(id: Connection["id"]) {
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
    <AppShell title="Connections" subtitle="Link the systems your workflows need to act in">
      <div className="max-w-4xl mx-auto p-8 space-y-6">
        <div className="card divide-y divide-ink-200">
          {CONNECTION_DEFS.map((def) => {
            const conn = connections.find((c) => c.id === def.id);
            const ok = !!conn?.connected;
            const AuthIcon = AUTH_ICON[def.authKind];
            return (
              <div key={def.id} className="p-5 flex items-start gap-4">
                <div className={cls(
                  "w-11 h-11 rounded-lg grid place-items-center shrink-0",
                  ok ? "bg-emerald-50 text-emerald-700" : def.required ? "bg-amber-50 text-amber-700" : "bg-ink-100 text-ink-600"
                )}>
                  {ok ? <CheckCircle2 className="w-5 h-5" /> : def.required ? <AlertCircle className="w-5 h-5" /> : <Plug className="w-5 h-5" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="text-sm font-semibold text-ink-900">{def.name}</div>
                    {def.required && <span className="chip-amber">Required</span>}
                    {ok && <span className="chip-green">Connected</span>}
                    <span className="chip-gray inline-flex items-center gap-1">
                      <AuthIcon className="w-3 h-3" />
                      {def.authKind === "oauth" ? "OAuth 2.0" : def.authKind === "api-key" ? "API key" : "Webhook"}
                    </span>
                  </div>
                  <p className="text-xs text-ink-500 mt-1">{def.description}</p>
                  {ok && (
                    <p className="text-[11px] text-ink-500 mt-2">
                      <span className="font-medium text-ink-700">{conn?.account}</span>
                      {conn?.env && <> · env: {conn.env}</>}
                      {conn?.connectedAt && <> · connected {timeAgo(conn.connectedAt)}</>}
                    </p>
                  )}
                </div>
                <button onClick={() => toggle(def.id)} className={ok ? "btn-secondary" : "btn-primary"}>
                  {ok ? "Disconnect" : "Connect"}
                </button>
              </div>
            );
          })}
        </div>

        <div className="card p-5">
          <h3 className="text-sm font-semibold text-ink-900 mb-1">About connections</h3>
          <p className="text-xs text-ink-500 leading-relaxed">
            All credentials are stored encrypted at rest. OAuth tokens are scoped to the
            minimum permissions needed by the workflows you have built. You can revoke a
            connection at any time — running workflows will fail-clean and any in-flight
            human approvals will be released back to their assignees.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
