// Types for the server-side Encompass adapter.
// These mirror the EDC REST API shapes we depend on, narrowed to what the
// platform actually reads.

export type EncompassEnv = "sandbox" | "production";

export type EncompassGrantType = "client_credentials" | "password";

export interface EncompassCredentials {
  env: EncompassEnv;
  grantType: EncompassGrantType;
  clientId: string;
  clientSecret: string;
  /** EDC tenant / instance identifier. Required for the password grant. */
  instanceId?: string;
  /** API user (e.g., "apiuser") for the password grant. Combined as `${apiUser}@${instanceId}`. */
  apiUser?: string;
  apiPassword?: string;
  /** OAuth scope (optional). */
  scope?: string;
  /** Override base URLs for non-default hosts. */
  apiBaseUrl?: string;
  oauthBaseUrl?: string;
}

export interface EncompassToken {
  accessToken: string;
  tokenType: "Bearer";
  expiresAt: number;     // epoch ms
  scope?: string;
  obtainedAt: number;    // epoch ms
}

export interface EncompassError extends Error {
  status?: number;
  code?: string;
  details?: unknown;
  retryable?: boolean;
}

export interface SmokeTestResult {
  ok: boolean;
  env: EncompassEnv;
  apiBaseUrl: string;
  oauthBaseUrl: string;
  tokenObtainedAt: number;
  tokenExpiresAt: number;
  latencyMs: number;
  /** Number of records read from the smoke endpoint (e.g. pipeline limit=1). */
  sampleCount: number;
  /** A non-sensitive identifier echoed by EDC, used as a sanity check. */
  echo?: string;
}

export interface AdapterOptions {
  /** Override fetch (for tests). */
  fetchImpl?: typeof fetch;
  /** Override "now" (for tests). */
  now?: () => number;
  /** Token cache hook — defaults to in-process Map. */
  tokenCache?: TokenCache;
  /** Audit logger. */
  audit?: (event: AuditEvent) => void;
}

export interface TokenCache {
  get(key: string): EncompassToken | undefined;
  set(key: string, token: EncompassToken): void;
  delete(key: string): void;
}

export type AuditEvent =
  | { kind: "token.issued"; env: EncompassEnv; expiresAt: number }
  | { kind: "token.refreshed"; env: EncompassEnv; expiresAt: number }
  | { kind: "request"; method: string; url: string; status: number; durationMs: number; attempt: number }
  | { kind: "guardrail.blocked"; method: string; url: string; reason: string }
  | { kind: "retry"; attempt: number; nextDelayMs: number; reason: string };
