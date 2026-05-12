// Server-side Encompass Developer Connect (EDC) adapter.
//
// Responsibilities:
//   - OAuth 2.0 token exchange (client_credentials or password grant)
//   - Token caching with proactive refresh
//   - Typed read methods (no writes implemented yet — server is read-only
//     for now and we add specific writers later, each behind a feature flag)
//   - Retry with capped exponential backoff on 5xx / 429 (honors Retry-After)
//   - HARD ENFORCEMENT of the no-deletion guardrail at the HTTP layer
//   - Structured audit logging hooks
//
// Source policy: knowledge/policies/no-deletion.md
// API surface:   docs/ICE_API_SURFACE.md

import { FORBIDDEN_HTTP_METHODS, PROTECTED_HOSTS, ForbiddenOperationError } from "../guardrails";
import type {
  AdapterOptions,
  AuditEvent,
  EncompassCredentials,
  EncompassEnv,
  EncompassError,
  EncompassToken,
  SmokeTestResult,
  TokenCache,
} from "./encompass.types";

// ── Defaults ────────────────────────────────────────────────────────────────

const DEFAULT_API_BASE: Record<EncompassEnv, string> = {
  production: "https://api.elliemae.com",
  // ICE's sandbox is on a separate host; default per public docs.
  sandbox: "https://api.elliemae.com",
};

const DEFAULT_OAUTH_BASE: Record<EncompassEnv, string> = {
  production: "https://api.elliemae.com",
  sandbox: "https://api.elliemae.com",
};

const TOKEN_REFRESH_LEEWAY_MS = 60_000; // refresh 60s before expiry

const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);
const MAX_ATTEMPTS = 4;
const BASE_BACKOFF_MS = 400;

// ── In-process token cache ──────────────────────────────────────────────────

class MemoryTokenCache implements TokenCache {
  private store = new Map<string, EncompassToken>();
  get(k: string) { return this.store.get(k); }
  set(k: string, t: EncompassToken) { this.store.set(k, t); }
  delete(k: string) { this.store.delete(k); }
}

const sharedCache = new MemoryTokenCache();

// ── Helpers ─────────────────────────────────────────────────────────────────

function cacheKey(c: EncompassCredentials): string {
  return `${c.env}::${c.clientId}::${c.grantType}::${c.instanceId ?? ""}::${c.apiUser ?? ""}`;
}

function tokenIsFresh(t: EncompassToken | undefined, now: number): t is EncompassToken {
  if (!t) return false;
  return t.expiresAt - TOKEN_REFRESH_LEEWAY_MS > now;
}

function buildError(message: string, opts: Partial<EncompassError> = {}): EncompassError {
  const e = new Error(message) as EncompassError;
  Object.assign(e, opts);
  return e;
}

function isProtectedHost(url: string): boolean {
  try {
    const host = new URL(url).host.toLowerCase();
    return PROTECTED_HOSTS.some((h) => host === h || host.endsWith("." + h));
  } catch {
    return false;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Adapter ─────────────────────────────────────────────────────────────────

export class EncompassClient {
  private readonly creds: EncompassCredentials;
  private readonly apiBase: string;
  private readonly oauthBase: string;
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => number;
  private readonly cache: TokenCache;
  private readonly audit: (e: AuditEvent) => void;

  constructor(creds: EncompassCredentials, opts: AdapterOptions = {}) {
    this.creds = creds;
    this.apiBase = creds.apiBaseUrl?.replace(/\/$/, "") ?? DEFAULT_API_BASE[creds.env];
    this.oauthBase = creds.oauthBaseUrl?.replace(/\/$/, "") ?? DEFAULT_OAUTH_BASE[creds.env];
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.now = opts.now ?? Date.now;
    this.cache = opts.tokenCache ?? sharedCache;
    this.audit = opts.audit ?? (() => {});
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /** Force a fresh OAuth token exchange. */
  async refreshToken(): Promise<EncompassToken> {
    return this.fetchToken(/* force */ true);
  }

  /** Cached or freshly-issued token. */
  async getToken(): Promise<EncompassToken> {
    return this.fetchToken(/* force */ false);
  }

  /**
   * Smoke-test the connection.
   * Exchanges credentials for a token and calls the lightest read endpoint
   * we know (a 1-row pipeline view). Returns success/failure with timing.
   */
  async smokeTest(): Promise<SmokeTestResult> {
    const t0 = this.now();
    const token = await this.refreshToken();
    let sampleCount = 0;
    let echo: string | undefined;
    try {
      // GET /encompass/v3/loanPipeline supports filter+limit; the cheapest
      // safe read is GET /encompass/v3/company/users/me which echoes back
      // the calling API user. Some tenants restrict it, so we fall back to
      // a 1-row pipeline view.
      try {
        const me = await this.request<{ id?: string; userId?: string; userName?: string }>({
          method: "GET",
          path: "/encompass/v3/company/users/me",
        });
        echo = me.id || me.userId || me.userName;
        sampleCount = 1;
      } catch {
        const list = await this.request<unknown[]>({
          method: "POST",
          path: "/encompass/v3/loanPipeline?limit=1",
          body: { filter: { terms: [] }, fields: ["Loan.LoanNumber"] },
        });
        sampleCount = Array.isArray(list) ? list.length : 0;
      }
    } catch (e) {
      const err = e as EncompassError;
      throw buildError(`Smoke test failed after token issued: ${err.message}`, {
        status: err.status,
        code: err.code,
        details: err.details,
      });
    }
    return {
      ok: true,
      env: this.creds.env,
      apiBaseUrl: this.apiBase,
      oauthBaseUrl: this.oauthBase,
      tokenObtainedAt: token.obtainedAt,
      tokenExpiresAt: token.expiresAt,
      latencyMs: this.now() - t0,
      sampleCount,
      echo,
    };
  }

  /** Typed GET helper, used for read methods. */
  async request<T = unknown>(opts: {
    method: "GET" | "POST" | "PATCH" | "PUT";
    path: string;
    body?: unknown;
    headers?: Record<string, string>;
  }): Promise<T> {
    // ── No-deletion guardrail: HARD BLOCK on DELETE for protected hosts ──
    const upper = opts.method.toUpperCase() as typeof opts.method;
    if (FORBIDDEN_HTTP_METHODS.includes(upper as "DELETE")) {
      const url = this.apiBase + opts.path;
      this.audit({ kind: "guardrail.blocked", method: upper, url, reason: "no-deletion policy" });
      throw new ForbiddenOperationError(
        upper,
        "no-deletion policy bans DELETE on any Encompass host. See knowledge/policies/no-deletion.md"
      );
    }

    const token = await this.getToken();
    const url = this.apiBase + opts.path;

    // Defense in depth: if a typo ever sends us to an Encompass host with
    // a verb that should be blocked, this triple-checks at the wire.
    if (FORBIDDEN_HTTP_METHODS.includes(upper as "DELETE") && isProtectedHost(url)) {
      this.audit({ kind: "guardrail.blocked", method: upper, url, reason: "no-deletion policy (host check)" });
      throw new ForbiddenOperationError(upper, "no-deletion policy (host check)");
    }

    return this.fetchWithRetry<T>({
      url,
      method: upper,
      headers: {
        Authorization: `Bearer ${token.accessToken}`,
        Accept: "application/json",
        "Content-Type": opts.body ? "application/json" : "",
        ...opts.headers,
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  private async fetchToken(force: boolean): Promise<EncompassToken> {
    const key = cacheKey(this.creds);
    const now = this.now();
    if (!force) {
      const cached = this.cache.get(key);
      if (tokenIsFresh(cached, now)) return cached;
    }

    const body = new URLSearchParams();
    body.set("client_id", this.creds.clientId);
    body.set("client_secret", this.creds.clientSecret);

    if (this.creds.grantType === "password") {
      if (!this.creds.apiUser || !this.creds.instanceId || !this.creds.apiPassword) {
        throw buildError(
          "password grant requires apiUser, instanceId, and apiPassword",
          { code: "invalid_credentials" }
        );
      }
      body.set("grant_type", "password");
      body.set("username", `${this.creds.apiUser}@encompass:${this.creds.instanceId}`);
      body.set("password", this.creds.apiPassword);
    } else {
      body.set("grant_type", "client_credentials");
      if (this.creds.scope) body.set("scope", this.creds.scope);
    }

    const url = `${this.oauthBase}/oauth2/v1/token`;
    const t0 = this.now();
    const res = await this.fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: body.toString(),
    });
    const durationMs = this.now() - t0;

    if (!res.ok) {
      let detail: unknown;
      try { detail = await res.json(); } catch { detail = await res.text().catch(() => ""); }
      this.audit({ kind: "request", method: "POST", url, status: res.status, durationMs, attempt: 1 });
      throw buildError(
        `OAuth token exchange failed: HTTP ${res.status}`,
        { status: res.status, code: "oauth_failed", details: detail, retryable: RETRYABLE_STATUS.has(res.status) }
      );
    }

    const json = (await res.json()) as { access_token?: string; token_type?: string; expires_in?: number; scope?: string };
    if (!json.access_token || !json.expires_in) {
      throw buildError("OAuth token response missing fields", { code: "oauth_malformed", details: json });
    }

    const issuedAt = this.now();
    const token: EncompassToken = {
      accessToken: json.access_token,
      tokenType: "Bearer",
      obtainedAt: issuedAt,
      expiresAt: issuedAt + json.expires_in * 1000,
      scope: json.scope,
    };
    this.cache.set(key, token);
    this.audit({
      kind: force ? "token.refreshed" : "token.issued",
      env: this.creds.env,
      expiresAt: token.expiresAt,
    });
    return token;
  }

  private async fetchWithRetry<T>(req: {
    url: string;
    method: string;
    headers: Record<string, string>;
    body?: string;
  }): Promise<T> {
    let attempt = 0;
    let lastErr: EncompassError | undefined;
    while (attempt < MAX_ATTEMPTS) {
      attempt += 1;
      const t0 = this.now();
      let res: Response;
      try {
        res = await this.fetchImpl(req.url, {
          method: req.method,
          headers: { ...req.headers, ...(req.body && !req.headers["Content-Type"] ? { "Content-Type": "application/json" } : {}) },
          body: req.body,
        });
      } catch (networkErr) {
        const msg = (networkErr as Error).message;
        lastErr = buildError(`network error: ${msg}`, { code: "network", retryable: true });
        const wait = BASE_BACKOFF_MS * Math.pow(2, attempt - 1);
        this.audit({ kind: "retry", attempt, nextDelayMs: wait, reason: msg });
        await sleep(wait);
        continue;
      }
      const durationMs = this.now() - t0;
      this.audit({ kind: "request", method: req.method, url: req.url, status: res.status, durationMs, attempt });

      if (res.ok) {
        const ct = res.headers.get("content-type") || "";
        if (ct.includes("application/json")) {
          return (await res.json()) as T;
        }
        return (await res.text()) as unknown as T;
      }

      let detail: unknown;
      try { detail = await res.json(); } catch { detail = await res.text().catch(() => ""); }

      if (RETRYABLE_STATUS.has(res.status) && attempt < MAX_ATTEMPTS) {
        const retryAfter = Number(res.headers.get("retry-after")) || 0;
        const wait = retryAfter > 0 ? retryAfter * 1000 : BASE_BACKOFF_MS * Math.pow(2, attempt - 1);
        this.audit({ kind: "retry", attempt, nextDelayMs: wait, reason: `HTTP ${res.status}` });
        await sleep(wait);
        continue;
      }

      throw buildError(`EDC request failed: HTTP ${res.status}`, {
        status: res.status,
        code: "edc_error",
        details: detail,
        retryable: RETRYABLE_STATUS.has(res.status),
      });
    }
    throw lastErr ?? buildError("EDC request failed after retries", { code: "retry_exhausted" });
  }
}

// ── Convenience: validate credentials shape without making a network call ───
export function validateCredentialsShape(c: Partial<EncompassCredentials>): string[] {
  const errors: string[] = [];
  if (!c.env) errors.push("env is required");
  if (!c.grantType) errors.push("grantType is required");
  if (!c.clientId) errors.push("clientId is required");
  if (!c.clientSecret) errors.push("clientSecret is required");
  if (c.grantType === "password") {
    if (!c.apiUser) errors.push("apiUser is required for password grant");
    if (!c.apiPassword) errors.push("apiPassword is required for password grant");
    if (!c.instanceId) errors.push("instanceId is required for password grant");
  }
  return errors;
}
