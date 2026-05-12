// POST /api/connections/encompass/test
//
// Exchanges the supplied (or env-supplied) Encompass credentials for an
// OAuth 2.0 token and exercises a lightweight read endpoint as a smoke test.
//
// The response is safe to display in the dashboard — it never echoes the
// secret back. Errors include status / code / a short detail string suitable
// for an end user, with the full upstream body redacted out of the response.

import { NextResponse } from "next/server";
import { EncompassClient } from "@/lib/server/encompass";
import { envOrOverride } from "@/lib/server/secrets";
import { validateCredentialsShape } from "@/lib/server/encompass";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PostBody {
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

export async function POST(req: Request) {
  let body: PostBody = {};
  try {
    body = (await req.json()) as PostBody;
  } catch {
    // accept empty body — env-only test
  }

  const creds = envOrOverride(body);
  const errors = validateCredentialsShape(creds);
  if (errors.length > 0) {
    return NextResponse.json(
      { ok: false, error: { code: "missing_credentials", message: errors.join("; ") } },
      { status: 400 }
    );
  }

  const client = new EncompassClient(creds);
  try {
    const result = await client.smokeTest();
    return NextResponse.json({ ok: true, result });
  } catch (e) {
    const err = e as Error & { status?: number; code?: string };
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: err.code || "unknown",
          status: err.status,
          message: err.message,
        },
      },
      { status: err.status && err.status >= 400 && err.status < 600 ? err.status : 502 }
    );
  }
}
