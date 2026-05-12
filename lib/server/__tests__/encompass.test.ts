// Unit tests for the EDC adapter.
// Mocks fetch; exercises OAuth flow, token cache, retries, error handling,
// and the no-deletion guardrail at the HTTP layer.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { EncompassClient, validateCredentialsShape } from "../encompass";
import type { EncompassCredentials, AuditEvent } from "../encompass.types";
import { ForbiddenOperationError } from "../../guardrails";

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

function textResponse(body: string, init: ResponseInit = {}): Response {
  return new Response(body, {
    status: 200,
    headers: { "content-type": "text/plain" },
    ...init,
  });
}

const baseCreds: EncompassCredentials = {
  env: "sandbox",
  grantType: "client_credentials",
  clientId: "cid_abc",
  clientSecret: "sec_xyz",
};

describe("validateCredentialsShape", () => {
  it("flags missing required fields", () => {
    const errs = validateCredentialsShape({});
    expect(errs).toContain("env is required");
    expect(errs).toContain("grantType is required");
    expect(errs).toContain("clientId is required");
    expect(errs).toContain("clientSecret is required");
  });

  it("requires password grant extras", () => {
    const errs = validateCredentialsShape({
      env: "sandbox",
      grantType: "password",
      clientId: "x",
      clientSecret: "y",
    });
    expect(errs).toContain("apiUser is required for password grant");
    expect(errs).toContain("apiPassword is required for password grant");
    expect(errs).toContain("instanceId is required for password grant");
  });

  it("passes when client_credentials are complete", () => {
    expect(validateCredentialsShape(baseCreds)).toEqual([]);
  });
});

describe("EncompassClient OAuth", () => {
  let auditEvents: AuditEvent[] = [];
  beforeEach(() => { auditEvents = []; });

  function makeClient(fetchImpl: typeof fetch) {
    return new EncompassClient(baseCreds, {
      fetchImpl,
      now: () => 1_700_000_000_000,
      tokenCache: { get: () => undefined, set: () => {}, delete: () => {} },
      audit: (e) => auditEvents.push(e),
    });
  }

  it("exchanges credentials for a token via client_credentials grant", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      expect(url).toContain("/oauth2/v1/token");
      const body = String(init?.body ?? "");
      expect(body).toContain("grant_type=client_credentials");
      expect(body).toContain("client_id=cid_abc");
      expect(body).toContain("client_secret=sec_xyz");
      return Promise.resolve(jsonResponse({ access_token: "tok_123", token_type: "Bearer", expires_in: 7200 }));
    });
    const client = makeClient(fetchMock as unknown as typeof fetch);
    const tok = await client.refreshToken();
    expect(tok.accessToken).toBe("tok_123");
    expect(tok.expiresAt).toBe(1_700_000_000_000 + 7200 * 1000);
    expect(auditEvents.some((e) => e.kind === "token.refreshed")).toBe(true);
  });

  it("sends the password grant with the apiuser@encompass:instance username", async () => {
    const fetchMock = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
      const body = decodeURIComponent(String(init?.body ?? ""));
      expect(body).toContain("grant_type=password");
      expect(body).toMatch(/username=apiuser@encompass:BE\d+/);
      expect(body).toContain("password=p455word");
      return Promise.resolve(jsonResponse({ access_token: "tok_pw", token_type: "Bearer", expires_in: 3600 }));
    });
    const client = new EncompassClient(
      { ...baseCreds, grantType: "password", apiUser: "apiuser", instanceId: "BE12345678", apiPassword: "p455word" },
      { fetchImpl: fetchMock as unknown as typeof fetch, audit: () => {} }
    );
    const tok = await client.refreshToken();
    expect(tok.accessToken).toBe("tok_pw");
  });

  it("uses cached token when fresh", async () => {
    let tokenCalls = 0;
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/oauth2/")) {
        tokenCalls++;
        return Promise.resolve(jsonResponse({ access_token: "tok_cache", token_type: "Bearer", expires_in: 7200 }));
      }
      return Promise.resolve(jsonResponse({ ok: true }));
    });
    const store = new Map<string, ReturnType<typeof Object>>();
    const client = new EncompassClient(baseCreds, {
      fetchImpl: fetchMock as unknown as typeof fetch,
      now: () => 1_700_000_000_000,
      tokenCache: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        get: (k) => store.get(k) as any,
        set: (k, v) => { store.set(k, v); },
        delete: (k) => { store.delete(k); },
      },
      audit: () => {},
    });
    await client.getToken();
    await client.getToken();
    await client.getToken();
    expect(tokenCalls).toBe(1);
  });

  it("propagates OAuth error with structured shape", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ error: "invalid_client" }, { status: 401 })
    );
    const client = makeClient(fetchMock as unknown as typeof fetch);
    await expect(client.refreshToken()).rejects.toMatchObject({
      message: expect.stringContaining("OAuth token exchange failed"),
      status: 401,
      code: "oauth_failed",
    });
  });
});

describe("EncompassClient request layer", () => {
  function makeClient(fetchImpl: typeof fetch, audit: (e: AuditEvent) => void = () => {}) {
    return new EncompassClient(baseCreds, {
      fetchImpl,
      now: () => 1_700_000_000_000,
      tokenCache: {
        get: () => ({
          accessToken: "tok",
          tokenType: "Bearer",
          expiresAt: 1_700_000_000_000 + 3600_000,
          obtainedAt: 1_700_000_000_000,
        }),
        set: () => {},
        delete: () => {},
      },
      audit,
    });
  }

  it("attaches Bearer token on requests", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ pong: true }));
    const client = makeClient(fetchMock as unknown as typeof fetch);
    await client.request({ method: "GET", path: "/encompass/v3/anything" });
    const [, init] = fetchMock.mock.calls[0];
    expect((init as RequestInit).headers).toMatchObject({ Authorization: "Bearer tok" });
  });

  it("returns parsed JSON on success", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ loanNumber: "L-1" }));
    const client = makeClient(fetchMock as unknown as typeof fetch);
    const r = await client.request<{ loanNumber: string }>({ method: "GET", path: "/encompass/v3/loans/abc" });
    expect(r.loanNumber).toBe("L-1");
  });

  it("returns text body when content-type is not JSON", async () => {
    const fetchMock = vi.fn().mockResolvedValue(textResponse("hello"));
    const client = makeClient(fetchMock as unknown as typeof fetch);
    const r = await client.request<string>({ method: "GET", path: "/encompass/v3/health" });
    expect(r).toBe("hello");
  });

  it("retries on 503 then succeeds", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ err: "down" }, { status: 503 }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));
    const events: AuditEvent[] = [];
    const client = makeClient(fetchMock as unknown as typeof fetch, (e) => events.push(e));
    const r = await client.request<{ ok: boolean }>({ method: "GET", path: "/encompass/v3/health" });
    expect(r.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(events.some((e) => e.kind === "retry")).toBe(true);
  });

  it("honors Retry-After on 429", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("", { status: 429, headers: { "retry-after": "0", "content-type": "application/json" } }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));
    const events: AuditEvent[] = [];
    const client = makeClient(fetchMock as unknown as typeof fetch, (e) => events.push(e));
    await client.request({ method: "GET", path: "/encompass/v3/anything" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry on 401", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ err: "denied" }, { status: 401 }));
    const client = makeClient(fetchMock as unknown as typeof fetch);
    await expect(client.request({ method: "GET", path: "/encompass/v3/anything" })).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("No-deletion guardrail (HTTP layer)", () => {
  it("throws ForbiddenOperationError on DELETE before any network call", async () => {
    const fetchMock = vi.fn();
    const client = new EncompassClient(baseCreds, {
      fetchImpl: fetchMock as unknown as typeof fetch,
      audit: () => {},
      tokenCache: { get: () => undefined, set: () => {}, delete: () => {} },
    });
    await expect(
      // @ts-expect-error — DELETE is not in the public method type; we go around to prove the guard fires
      client.request({ method: "DELETE", path: "/encompass/v3/loans/abc" })
    ).rejects.toBeInstanceOf(ForbiddenOperationError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("records the block in the audit log", async () => {
    const audit = vi.fn();
    const client = new EncompassClient(baseCreds, {
      fetchImpl: vi.fn() as unknown as typeof fetch,
      audit,
      tokenCache: { get: () => undefined, set: () => {}, delete: () => {} },
    });
    try {
      // @ts-expect-error — see above
      await client.request({ method: "DELETE", path: "/encompass/v3/loans/abc" });
    } catch { /* expected */ }
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({
      kind: "guardrail.blocked",
      method: "DELETE",
    }));
  });
});
