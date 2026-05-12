"use client";

import { useState } from "react";
import { X, Loader2, CheckCircle2, XCircle, ShieldCheck, Eye, EyeOff } from "lucide-react";
import { cls } from "@/lib/utils";

interface TestResult {
  ok: boolean;
  result?: {
    env: string;
    apiBaseUrl: string;
    oauthBaseUrl: string;
    tokenExpiresAt: number;
    tokenObtainedAt: number;
    latencyMs: number;
    sampleCount: number;
    echo?: string;
  };
  error?: {
    code?: string;
    status?: number;
    message: string;
  };
}

export function EncompassTestModal({ onClose }: { onClose: () => void }) {
  const [env, setEnv] = useState<"sandbox" | "production">("sandbox");
  const [grantType, setGrantType] = useState<"client_credentials" | "password">("client_credentials");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [instanceId, setInstanceId] = useState("");
  const [apiUser, setApiUser] = useState("");
  const [apiPassword, setApiPassword] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);

  async function runTest() {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/connections/encompass/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          env,
          grantType,
          clientId,
          clientSecret,
          instanceId: instanceId || undefined,
          apiUser: apiUser || undefined,
          apiPassword: apiPassword || undefined,
        }),
      });
      const json = (await res.json()) as TestResult;
      setResult(json);
    } catch (e) {
      setResult({ ok: false, error: { message: (e as Error).message } });
    } finally {
      setBusy(false);
    }
  }

  const canSubmit =
    clientId.trim().length > 0 &&
    clientSecret.trim().length > 0 &&
    (grantType === "client_credentials" ||
      (apiUser.trim().length > 0 && apiPassword.trim().length > 0 && instanceId.trim().length > 0));

  return (
    <div className="fixed inset-0 z-40 bg-ink-950/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(720px,92vw)] max-h-[90vh] bg-white rounded-2xl shadow-pop overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-14 px-5 flex items-center justify-between border-b border-ink-200 shrink-0">
          <div>
            <div className="text-sm font-semibold text-ink-900">Test Encompass connection</div>
            <div className="text-[11px] text-ink-500">
              Credentials are used for this test only and are never logged or stored in the browser.
            </div>
          </div>
          <button className="text-ink-500 hover:text-ink-900" onClick={onClose}><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-900 flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              The platform enforces a <strong>no-deletion guardrail</strong> on every Encompass call.
              Any DELETE-style request is blocked at the adapter before it reaches ICE.
            </span>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Environment</label>
              <div className="inline-flex w-full rounded-lg border border-ink-200 p-0.5 bg-white">
                {(["sandbox", "production"] as const).map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setEnv(e)}
                    className={cls(
                      "flex-1 h-9 rounded-md text-xs font-medium",
                      env === e ? "bg-ink-900 text-white" : "text-ink-600"
                    )}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="label">Grant type</label>
              <select className="input" value={grantType} onChange={(e) => setGrantType(e.target.value as "client_credentials" | "password")}>
                <option value="client_credentials">client_credentials</option>
                <option value="password">password (api user)</option>
              </select>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Client ID</label>
              <input
                className="input font-mono text-xs"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="from EDC admin console"
                autoComplete="off"
              />
            </div>
            <div>
              <label className="label">Client Secret</label>
              <div className="relative">
                <input
                  className="input font-mono text-xs pr-8"
                  type={showSecret ? "text" : "password"}
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => setShowSecret((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-800"
                >
                  {showSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>

          {grantType === "password" && (
            <div className="grid sm:grid-cols-3 gap-3">
              <div>
                <label className="label">Instance ID</label>
                <input className="input font-mono text-xs" value={instanceId} onChange={(e) => setInstanceId(e.target.value)} />
              </div>
              <div>
                <label className="label">API User</label>
                <input className="input font-mono text-xs" value={apiUser} onChange={(e) => setApiUser(e.target.value)} placeholder="apiuser" />
              </div>
              <div>
                <label className="label">API Password</label>
                <div className="relative">
                  <input
                    className="input font-mono text-xs pr-8"
                    type={showPassword ? "text" : "password"}
                    value={apiPassword}
                    onChange={(e) => setApiPassword(e.target.value)}
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-800"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>
          )}

          {result && (
            <div
              className={cls(
                "rounded-xl border p-4",
                result.ok ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"
              )}
            >
              <div className="flex items-center gap-2 mb-2">
                {result.ok ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-600" />
                )}
                <div className="text-sm font-semibold text-ink-900">
                  {result.ok ? "Connection successful" : "Connection failed"}
                </div>
              </div>
              {result.ok && result.result && (
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-ink-700">
                  <Row label="Env"><code className="font-mono">{result.result.env}</code></Row>
                  <Row label="Latency"><code className="font-mono">{result.result.latencyMs}ms</code></Row>
                  <Row label="API base"><code className="font-mono text-[11px]">{result.result.apiBaseUrl}</code></Row>
                  <Row label="Token expires in"><code className="font-mono">{Math.round((result.result.tokenExpiresAt - Date.now()) / 60000)}m</code></Row>
                  <Row label="Records read"><code className="font-mono">{result.result.sampleCount}</code></Row>
                  {result.result.echo && <Row label="API user echo"><code className="font-mono">{result.result.echo}</code></Row>}
                </dl>
              )}
              {!result.ok && result.error && (
                <div className="text-xs text-red-900">
                  <div className="flex gap-2 mb-1.5">
                    {result.error.code && <span className="chip-red">{result.error.code}</span>}
                    {result.error.status && <span className="chip-red">HTTP {result.error.status}</span>}
                  </div>
                  <pre className="whitespace-pre-wrap font-mono text-[11px]">{result.error.message}</pre>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="h-14 border-t border-ink-200 bg-ink-50 px-5 flex items-center justify-between shrink-0">
          <p className="text-[11px] text-ink-500">
            Calls <code className="font-mono">/oauth2/v1/token</code> then a lightweight read.
          </p>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="btn-secondary h-9">Close</button>
            <button onClick={runTest} className="btn-primary h-9" disabled={!canSubmit || busy}>
              {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> Testing…</> : "Run test"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-ink-500">{label}</dt>
      <dd>{children}</dd>
    </>
  );
}
