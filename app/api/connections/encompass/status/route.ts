// GET /api/connections/encompass/status
//
// Reports whether the server has Encompass credentials configured via env,
// without making a network call. Use the /test endpoint to actually verify.

import { NextResponse } from "next/server";
import { credsFromEnv } from "@/lib/server/secrets";
import { validateCredentialsShape } from "@/lib/server/encompass";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const creds = credsFromEnv();
  const errors = validateCredentialsShape(creds);
  return NextResponse.json({
    configured: errors.length === 0,
    missing: errors,
    env: creds.env ?? null,
    grantType: creds.grantType ?? null,
    clientIdPreview: creds.clientId ? `${creds.clientId.slice(0, 4)}…` : null,
    apiBaseUrl: creds.apiBaseUrl ?? null,
  });
}
