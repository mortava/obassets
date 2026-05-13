// Integration test — full HTTP path.
//
// Spins up a small mock EDC server, points the adapter at it, and exercises:
//   - OAuth 2.0 client_credentials token exchange
//   - Bearer token attached to subsequent reads
//   - /company/users/me smoke endpoint
//   - Failure → fallback to /loanPipeline
//   - Error surfacing on auth failure
//   - No-deletion guardrail on DELETE
//   - The Next.js route handler when called directly with a Request
//
// This is the strongest "the dashboard ↔ Encompass connection works"
// proof we can run without real ICE sandbox credentials: every HTTP
// connection is a real socket; only the server on the other side is
// simulated.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer, type Server, type IncomingMessage, type ServerResponse } from "node:http";
import { AddressInfo } from "node:net";
import { EncompassClient } from "../encompass";
import { POST as testRoutePost } from "../../../app/api/connections/encompass/test/route";

// ── Mock EDC server ────────────────────────────────────────────────────────

interface MockOpts {
  /** Force the OAuth endpoint to fail with this status. */
  oauthStatus?: number;
  /** Force the /me endpoint to fail with this status (falls back to pipeline). */
  meStatus?: number;
  /** Number of pipeline rows to return. */
  pipelineRows?: number;
  /** Record requests as they arrive. */
  log?: Array<{ method: string; url: string; auth?: string; body?: string }>;
}

function startMockEDC(opts: MockOpts = {}): Promise<{ server: Server; port: number }> {
  return new Promise((resolve) => {
    const log = opts.log ?? [];
    const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
      const chunks: Buffer[] = [];
      for await (const c of req) chunks.push(c as Buffer);
      const body = Buffer.concat(chunks).toString("utf-8");
      const auth = req.headers["authorization"] as string | undefined;
      log.push({ method: req.method!, url: req.url!, auth, body: body || undefined });

      // OAuth 2.0 token endpoint
      if (req.url === "/oauth2/v1/token" && req.method === "POST") {
        if (opts.oauthStatus && opts.oauthStatus !== 200) {
          res.writeHead(opts.oauthStatus, { "content-type": "application/json" });
          res.end(JSON.stringify({ error: "invalid_client" }));
          return;
        }
        // Only accept the credentials we expect
        if (!body.includes("client_id=test_cid") || !body.includes("client_secret=test_sec")) {
          res.writeHead(401, { "content-type": "application/json" });
          res.end(JSON.stringify({ error: "invalid_client" }));
          return;
        }
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({
          access_token: "mock-token-abc",
          token_type: "Bearer",
          expires_in: 3600,
          scope: "lp",
        }));
        return;
      }

      // /me endpoint — requires Bearer token
      if (req.url === "/encompass/v3/company/users/me" && req.method === "GET") {
        if (auth !== "Bearer mock-token-abc") {
          res.writeHead(401, { "content-type": "application/json" });
          res.end(JSON.stringify({ error: "unauthorized" }));
          return;
        }
        if (opts.meStatus && opts.meStatus !== 200) {
          res.writeHead(opts.meStatus, { "content-type": "application/json" });
          res.end(JSON.stringify({ error: "not_available" }));
          return;
        }
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ id: "api-user-1", userId: "apiuser", userName: "apiuser@mock" }));
        return;
      }

      // Pipeline fallback
      if (req.url?.startsWith("/encompass/v3/loanPipeline") && req.method === "POST") {
        if (auth !== "Bearer mock-token-abc") {
          res.writeHead(401, { "content-type": "application/json" });
          res.end(JSON.stringify({ error: "unauthorized" }));
          return;
        }
        const rows = Array.from({ length: opts.pipelineRows ?? 1 }, (_, i) => ({
          fields: { "Loan.LoanNumber": `L-${i + 1}` },
        }));
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify(rows));
        return;
      }

      res.writeHead(404, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "not_found", path: req.url }));
    });

    server.listen(0, "127.0.0.1", () => {
      const port = (server.address() as AddressInfo).port;
      resolve({ server, port });
    });
  });
}

function stopServer(server: Server): Promise<void> {
  return new Promise((resolve) => server.close(() => resolve()));
}

// ── Direct adapter integration ─────────────────────────────────────────────

describe("EncompassClient → mock EDC over real HTTP", () => {
  let server: Server;
  let baseUrl: string;
  const log: Array<{ method: string; url: string; auth?: string; body?: string }> = [];

  beforeAll(async () => {
    const r = await startMockEDC({ log });
    server = r.server;
    baseUrl = `http://127.0.0.1:${r.port}`;
  });
  afterAll(async () => { await stopServer(server); });

  it("performs OAuth, calls /me, and returns a structured result", async () => {
    const client = new EncompassClient({
      env: "sandbox",
      grantType: "client_credentials",
      clientId: "test_cid",
      clientSecret: "test_sec",
      apiBaseUrl: baseUrl,
      oauthBaseUrl: baseUrl,
    });
    const result = await client.smokeTest();
    expect(result.ok).toBe(true);
    expect(result.sampleCount).toBe(1);
    expect(result.echo).toBe("api-user-1");
    expect(result.tokenExpiresAt).toBeGreaterThan(result.tokenObtainedAt);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);

    // Verify the OAuth call carried the credentials
    const oauthCall = log.find((l) => l.url === "/oauth2/v1/token");
    expect(oauthCall).toBeDefined();
    expect(oauthCall!.body).toContain("client_id=test_cid");
    expect(oauthCall!.body).toContain("client_secret=test_sec");

    // Verify the /me call carried the bearer token issued by the mock
    const meCall = log.find((l) => l.url === "/encompass/v3/company/users/me");
    expect(meCall).toBeDefined();
    expect(meCall!.auth).toBe("Bearer mock-token-abc");
  });

  it("falls back to pipeline when /me is unavailable", async () => {
    const fallbackLog: typeof log = [];
    const r = await startMockEDC({ meStatus: 404, pipelineRows: 1, log: fallbackLog });
    try {
      const client = new EncompassClient({
        env: "sandbox",
        grantType: "client_credentials",
        clientId: "test_cid",
        clientSecret: "test_sec",
        apiBaseUrl: `http://127.0.0.1:${r.port}`,
        oauthBaseUrl: `http://127.0.0.1:${r.port}`,
      });
      const result = await client.smokeTest();
      expect(result.ok).toBe(true);
      expect(result.sampleCount).toBe(1);
      expect(fallbackLog.some((l) => l.url.startsWith("/encompass/v3/loanPipeline"))).toBe(true);
    } finally {
      await stopServer(r.server);
    }
  });

  it("surfaces oauth_failed on invalid client", async () => {
    const r = await startMockEDC({ oauthStatus: 401 });
    try {
      const client = new EncompassClient({
        env: "sandbox",
        grantType: "client_credentials",
        clientId: "test_cid",
        clientSecret: "test_sec",
        apiBaseUrl: `http://127.0.0.1:${r.port}`,
        oauthBaseUrl: `http://127.0.0.1:${r.port}`,
      });
      await expect(client.smokeTest()).rejects.toMatchObject({
        code: "oauth_failed",
        status: 401,
      });
    } finally {
      await stopServer(r.server);
    }
  });

  it("blocks DELETE before any HTTP call (no-deletion guardrail)", async () => {
    const guardLog: typeof log = [];
    const r = await startMockEDC({ log: guardLog });
    try {
      const client = new EncompassClient({
        env: "sandbox",
        grantType: "client_credentials",
        clientId: "test_cid",
        clientSecret: "test_sec",
        apiBaseUrl: `http://127.0.0.1:${r.port}`,
        oauthBaseUrl: `http://127.0.0.1:${r.port}`,
      });
      await expect(
        // @ts-expect-error — DELETE not in public type; testing the runtime guard
        client.request({ method: "DELETE", path: "/encompass/v3/loans/abc" })
      ).rejects.toThrow(/no-deletion/);
      // No DELETE request should have hit the mock
      expect(guardLog.every((l) => l.method !== "DELETE")).toBe(true);
    } finally {
      await stopServer(r.server);
    }
  });
});

// ── Next.js API route handler integration ──────────────────────────────────

describe("POST /api/connections/encompass/test (route handler)", () => {
  let server: Server;
  let baseUrl: string;
  const savedEnv = { ...process.env };

  beforeAll(async () => {
    const r = await startMockEDC();
    server = r.server;
    baseUrl = `http://127.0.0.1:${r.port}`;
  });
  afterAll(async () => {
    await stopServer(server);
    process.env = savedEnv;
  });

  it("returns ok:true when credentials succeed against mock EDC", async () => {
    const req = new Request("http://test.local/api/connections/encompass/test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        env: "sandbox",
        grantType: "client_credentials",
        clientId: "test_cid",
        clientSecret: "test_sec",
        apiBaseUrl: baseUrl,
        oauthBaseUrl: baseUrl,
      }),
    });
    const res = await testRoutePost(req);
    expect(res.status).toBe(200);
    const json = (await res.json()) as { ok: boolean; result?: { sampleCount: number; echo?: string } };
    expect(json.ok).toBe(true);
    expect(json.result?.sampleCount).toBe(1);
    expect(json.result?.echo).toBe("api-user-1");
  });

  it("returns 400 when credentials are missing", async () => {
    const req = new Request("http://test.local/api/connections/encompass/test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    // Ensure no env creds bleed in for this case
    delete process.env.ENCOMPASS_CLIENT_ID;
    delete process.env.ENCOMPASS_CLIENT_SECRET;
    const res = await testRoutePost(req);
    expect(res.status).toBe(400);
    const json = (await res.json()) as { ok: boolean; error?: { code: string } };
    expect(json.ok).toBe(false);
    expect(json.error?.code).toBe("missing_credentials");
  });

  it("surfaces oauth_failed status when EDC rejects the secret", async () => {
    const r = await startMockEDC({ oauthStatus: 401 });
    try {
      const req = new Request("http://test.local/api/connections/encompass/test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          env: "sandbox",
          grantType: "client_credentials",
          clientId: "test_cid",
          clientSecret: "test_sec",
          apiBaseUrl: `http://127.0.0.1:${r.port}`,
          oauthBaseUrl: `http://127.0.0.1:${r.port}`,
        }),
      });
      const res = await testRoutePost(req);
      expect(res.status).toBe(401);
      const json = (await res.json()) as { ok: boolean; error?: { code: string; status: number } };
      expect(json.ok).toBe(false);
      expect(json.error?.code).toBe("oauth_failed");
      expect(json.error?.status).toBe(401);
    } finally {
      await stopServer(r.server);
    }
  });
});
