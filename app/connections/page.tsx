"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, AlertCircle, Plug, ExternalLink, KeyRound, Webhook, FlaskConical, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { EncompassTestModal } from "@/components/EncompassTestModal";
import { listConnections, setConnection } from "@/lib/storage";
import { CONNECTION_DEFS } from "@/lib/catalog";
import type { Connection } from "@/lib/types";
import { cls, timeAgo } from "@/lib/utils";

const AUTH_ICON = {
  oauth: ExternalLink,
  "api-key": KeyRound,
  webhook: Webhook,
} as const;

interface ServerStatus {
  configured: boolean;
  missing: string[];
  env: "sandbox" | "production" | null;
  grantType: string | null;
  clientIdPreview: string | null;
  apiBaseUrl: string | null;
}

export default function ConnectionsPage() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [showTest, setShowTest] = useState(false);
  const [serverStatus, setServerStatus] = useState<ServerStatus | null>(null);

  useEffect(() => {
    setConnections(listConnections());
    // Pull the server-side env status so the user can see whether
    // credentials are already configured via Vercel / .env without
    // sending anything to the browser.
    fetch("/api/connections/encompass/status")
      .then((r) => r.json() as Promise<ServerStatus>)
      .then(setServerStatus)
      .catch(() => setServerStatus(null));
  }, []);

  function toggle(id: Connection["id"]) {
    const existing = connections.find((c) => c.id === id);
    const next: Connection = existing?.connected
      ? { id, connected: false }
      : {
          id,
          connected: true,
          connectedAt: new Date().toISOString(),
          account: id === "encompass" ? (serverStatus?.env === "production" ? "Production tenant" : "Sandbox tenant") : id === "anthropic" ? "team-key" : "Demo workspace",
          env: id === "encompass" ? (serverStatus?.env ?? "sandbox") : undefined,
        };
    setConnection(next);
    setConnections(listConnections());
  }

  return (
    <AppShell title="Connections" subtitle="Link the systems your workflows need to act in">
      <div className="max-w-4xl mx-auto p-8 space-y-6">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900 flex items-start gap-2">
          <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            All Encompass calls flow through the server-side adapter. The <strong>no-deletion guardrail</strong>{" "}
            is enforced at the HTTP layer — DELETE requests against any ICE host are blocked before they leave the process.
          </span>
        </div>

        <div className="card divide-y divide-ink-200">
          {CONNECTION_DEFS.map((def) => {
            const conn = connections.find((c) => c.id === def.id);
            const ok = !!conn?.connected;
            const AuthIcon = AUTH_ICON[def.authKind];
            const isEncompass = def.id === "encompass";
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
                    {isEncompass && serverStatus?.configured && (
                      <span className="chip-brand">env vars detected</span>
                    )}
                  </div>
                  <p className="text-xs text-ink-500 mt-1">{def.description}</p>
                  {ok && (
                    <p className="text-[11px] text-ink-500 mt-2">
                      <span className="font-medium text-ink-700">{conn?.account}</span>
                      {conn?.env && <> · env: {conn.env}</>}
                      {conn?.connectedAt && <> · connected {timeAgo(conn.connectedAt)}</>}
                    </p>
                  )}
                  {isEncompass && serverStatus && !serverStatus.configured && serverStatus.missing.length > 0 && (
                    <p className="text-[11px] text-ink-500 mt-2">
                      <span className="text-amber-700">Server env missing:</span>{" "}
                      <code className="font-mono text-[10px]">{serverStatus.missing.join(", ")}</code>
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {isEncompass && (
                    <button onClick={() => setShowTest(true)} className="btn-secondary h-9">
                      <FlaskConical className="w-3.5 h-3.5" />
                      Test connection
                    </button>
                  )}
                  <button onClick={() => toggle(def.id)} className={ok ? "btn-secondary h-9" : "btn-primary h-9"}>
                    {ok ? "Disconnect" : "Connect"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="card p-5">
          <h3 className="text-sm font-semibold text-ink-900 mb-1">About connections</h3>
          <p className="text-xs text-ink-500 leading-relaxed">
            All credentials are stored encrypted at rest (KMS-backed vault in production; environment
            variables in the current build). OAuth tokens are scoped to the minimum permissions
            needed by the workflows you have built. You can revoke a connection at any time —
            running workflows will fail-clean and any in-flight human approvals will be released
            back to their assignees.
          </p>
          <p className="text-xs text-ink-500 leading-relaxed mt-2">
            For instructions on provisioning the Encompass API user and configuring environment
            variables, see <code className="font-mono">docs/ENCOMPASS_SETUP.md</code>.
          </p>
        </div>
      </div>

      {showTest && <EncompassTestModal onClose={() => setShowTest(false)} />}
    </AppShell>
  );
}
