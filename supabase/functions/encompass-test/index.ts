// encompass-test — Supabase Edge Function.
//
// A production endpoint that performs the exact same Encompass OAuth 2.0
// smoke test as the Next.js dashboard's /api/connections/encompass/test
// route. Used to prove the dashboard ↔ Encompass connection works on real
// cloud infrastructure with a public URL.
//
// Routes:
//   GET  /encompass-test/healthz                  → liveness
//   POST /encompass-test            (body=creds)  → smoke test against ICE
//
// SAFETY / POLICY:
//   - This function is read-only against Encompass: OAuth + a single GET.
//   - DELETE methods are explicitly refused at the HTTP layer per the
//     no-deletion platform policy (knowledge/policies/no-deletion.md).
//   - Credentials in the POST body are used for this single request and
//     never persisted. Empty body returns 400.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const PROTECTED_HOSTS = [
  "api.elliemae.com",
  "api.encompass.com",
  "developer.icemortgagetechnology.com",
];

interface Creds {
  env?: "sandbox" | "production";
  grantType?: "client_credentials" | "password";
  clientId?: string;
  clientSecret?: string;
  instanceId?: string;
  apiUser?: string;
  apiPassword?: string;
  scope?: string;
  apiBaseUrl?: string;
  oauthBaseUrl?: string;
}

function validate(c: Creds): string[] {
  const errs: string[] = [];
  if (!c.env) errs.push("env is required");
  if (!c.grantType) errs.push("grantType is required");
  if (!c.clientId) errs.push("clientId is required");
  if (!c.clientSecret) errs.push("clientSecret is required");
  if (c.grantType === "password") {
    if (!c.apiUser) errs.push("apiUser is required for password grant");
    if (!c.apiPassword) errs.push("apiPassword is required for password grant");
    if (!c.instanceId) errs.push("instanceId is required for password grant");
  }
  return errs;
}

function credsFromEnv(): Creds {
  return {
    env: (Deno.env.get("ENCOMPASS_ENV") as "sandbox" | "production") || "sandbox",
    grantType: (Deno.env.get("ENCOMPASS_GRANT_TYPE") as "client_credentials" | "password") || "client_credentials",
    clientId: Deno.env.get("ENCOMPASS_CLIENT_ID") || undefined,
    clientSecret: Deno.env.get("ENCOMPASS_CLIENT_SECRET") || undefined,
    instanceId: Deno.env.get("ENCOMPASS_INSTANCE_ID") || undefined,
    apiUser: Deno.env.get("ENCOMPASS_API_USER") || undefined,
    apiPassword: Deno.env.get("ENCOMPASS_API_PASSWORD") || undefined,
    scope: Deno.env.get("ENCOMPASS_SCOPE") || undefined,
    apiBaseUrl: Deno.env.get("ENCOMPASS_API_BASE_URL") || undefined,
    oauthBaseUrl: Deno.env.get("ENCOMPASS_OAUTH_BASE_URL") || undefined,
  };
}

function isProtectedHost(url: string): boolean {
  try {
    const host = new URL(url).host.toLowerCase();
    return PROTECTED_HOSTS.some((h) => host === h || host.endsWith("." + h));
  } catch {
    return false;
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "access-control-allow-origin": "*" },
  });
}

async function smokeTest(c: Required<Pick<Creds, "env" | "grantType" | "clientId" | "clientSecret">> & Creds) {
  const apiBase = (c.apiBaseUrl ?? "https://api.elliemae.com").replace(/\/$/, "");
  const oauthBase = (c.oauthBaseUrl ?? "https://api.elliemae.com").replace(/\/$/, "");
  const t0 = Date.now();

  // ── OAuth 2.0 token exchange
  const form = new URLSearchParams();
  form.set("client_id", c.clientId);
  form.set("client_secret", c.clientSecret);
  if (c.grantType === "password") {
    form.set("grant_type", "password");
    form.set("username", `${c.apiUser}@encompass:${c.instanceId}`);
    form.set("password", c.apiPassword!);
  } else {
    form.set("grant_type", "client_credentials");
    if (c.scope) form.set("scope", c.scope);
  }

  const tokenRes = await fetch(`${oauthBase}/oauth2/v1/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: form.toString(),
  });

  if (!tokenRes.ok) {
    let detail: unknown;
    try { detail = await tokenRes.json(); } catch { detail = await tokenRes.text().catch(() => ""); }
    return {
      ok: false,
      error: {
        code: "oauth_failed",
        status: tokenRes.status,
        message: `OAuth token exchange failed: HTTP ${tokenRes.status}`,
        upstreamDetail: detail,
      },
    };
  }

  const tok = (await tokenRes.json()) as { access_token?: string; expires_in?: number };
  if (!tok.access_token || !tok.expires_in) {
    return { ok: false, error: { code: "oauth_malformed", message: "OAuth response missing fields" } };
  }

  const tokenObtainedAt = Date.now();
  const tokenExpiresAt = tokenObtainedAt + tok.expires_in * 1000;

  // ── Lightweight read: /me with fallback to pipeline
  let echo: string | undefined;
  let sampleCount = 0;
  try {
    const meRes = await fetch(`${apiBase}/encompass/v3/company/users/me`, {
      method: "GET",
      headers: { authorization: `Bearer ${tok.access_token}`, accept: "application/json" },
    });
    if (meRes.ok) {
      const me = (await meRes.json()) as { id?: string; userId?: string; userName?: string };
      echo = me.id || me.userId || me.userName;
      sampleCount = 1;
    } else {
      const list = await fetch(`${apiBase}/encompass/v3/loanPipeline?limit=1`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${tok.access_token}`,
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify({ filter: { terms: [] }, fields: ["Loan.LoanNumber"] }),
      });
      if (list.ok) {
        const rows = (await list.json()) as unknown[];
        sampleCount = Array.isArray(rows) ? rows.length : 0;
      } else {
        return { ok: false, error: { code: "edc_error", status: list.status, message: `Pipeline read failed: HTTP ${list.status}` } };
      }
    }
  } catch (e) {
    return { ok: false, error: { code: "read_failed", message: (e as Error).message } };
  }

  return {
    ok: true,
    result: {
      env: c.env,
      apiBaseUrl: apiBase,
      oauthBaseUrl: oauthBase,
      tokenObtainedAt,
      tokenExpiresAt,
      latencyMs: Date.now() - t0,
      sampleCount,
      echo,
    },
  };
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const method = req.method.toUpperCase();

  // ── No-deletion guardrail: refuse DELETE regardless of path
  if (method === "DELETE") {
    return json(
      {
        ok: false,
        error: {
          code: "forbidden_operation",
          message: "DELETE is forbidden by the platform no-deletion policy.",
        },
      },
      405,
    );
  }

  // CORS preflight
  if (method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET, POST, OPTIONS",
        "access-control-allow-headers": "content-type, authorization",
      },
    });
  }

  // Healthz
  if (method === "GET" && (url.pathname.endsWith("/healthz") || url.pathname.endsWith("/health"))) {
    return json({
      ok: true,
      service: "encompass-test",
      time: new Date().toISOString(),
      protectedHosts: PROTECTED_HOSTS,
      noDeletionGuardrail: "active",
    });
  }

  // Status
  if (method === "GET") {
    const env = credsFromEnv();
    const errs = validate(env);
    return json({
      configured: errs.length === 0,
      missing: errs,
      env: env.env ?? null,
      grantType: env.grantType ?? null,
      clientIdPreview: env.clientId ? env.clientId.slice(0, 4) + "…" : null,
      apiBaseUrl: env.apiBaseUrl ?? null,
    });
  }

  // Smoke test
  if (method === "POST") {
    let body: Creds = {};
    try {
      const ct = req.headers.get("content-type") || "";
      if (ct.includes("application/json")) body = (await req.json()) as Creds;
    } catch {
      // empty body OK
    }
    const merged: Creds = { ...credsFromEnv() };
    for (const [k, v] of Object.entries(body)) {
      if (v !== undefined && v !== "") (merged as Record<string, unknown>)[k] = v;
    }
    const errs = validate(merged);
    if (errs.length > 0) {
      return json({ ok: false, error: { code: "missing_credentials", message: errs.join("; ") } }, 400);
    }
    // Sanity: only allow OAuth to flow to protected (Encompass) hosts
    const oauthBase = (merged.oauthBaseUrl ?? "https://api.elliemae.com").replace(/\/$/, "");
    if (!isProtectedHost(oauthBase)) {
      return json(
        {
          ok: false,
          error: {
            code: "forbidden_host",
            message: `oauthBaseUrl must be an Encompass host. Got: ${oauthBase}`,
          },
        },
        400,
      );
    }

    const res = await smokeTest(merged as Required<Pick<Creds, "env" | "grantType" | "clientId" | "clientSecret">> & Creds);
    const status = res.ok ? 200 : (res.error?.status && res.error.status >= 400 && res.error.status < 600 ? res.error.status : 502);
    return json(res, status);
  }

  return json({ ok: false, error: { code: "method_not_allowed" } }, 405);
});
