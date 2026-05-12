# Connecting the portal to Encompass

The portal talks to Encompass through a server-side adapter
(`lib/server/encompass.ts`). The Connections page in the
dashboard has a **Test connection** button that exchanges credentials for an
OAuth 2.0 token and exercises a lightweight read endpoint end-to-end, so you
can verify the wiring in one click.

This guide walks through the one-time setup.

## 1. Pick a grant type

EDC supports two OAuth 2.0 flows. The platform's adapter implements both —
pick what your ICE integration is provisioned for.

| Grant | When to use | What you need |
|---|---|---|
| `client_credentials` | Modern, recommended for service-to-service integrations | `client_id`, `client_secret`, optional `scope` |
| `password`           | Legacy SDK-style integrations still common in lender environments | `client_id`, `client_secret`, `instance_id`, `api_user`, `api_password` |

> **Never use a personal admin login.** Provision a dedicated API user in
> Encompass with the **least-privilege persona** for the endpoints your
> workflows touch. The platform refuses to use super-admin credentials at
> runtime.

## 2. Provision the EDC application

1. Log into the Encompass admin console as a user with the **Super
   Administrator** persona (the only persona allowed to mint API keys per
   ICE docs).
2. Create a new EDC application:
   - Note the `client_id` and `client_secret`.
   - For `client_credentials`, configure the scope(s) you need. The smoke
     test only needs read access to `/encompass/v3/company/users/me` or the
     pipeline.
3. Create a least-privilege API user (for the password grant) or attach the
   appropriate persona/scopes to the application (for client_credentials).
4. **Sandbox vs production**: ICE issues separate credentials per
   environment. The platform models environments as first-class — keep your
   credentials separate.

## 3. Configure environment variables

Copy `.env.example` to `.env.local` for local dev, or set these in **Vercel →
Project → Settings → Environment Variables** for production. Mark each as a
secret.

```
ENCOMPASS_ENV=sandbox
ENCOMPASS_GRANT_TYPE=client_credentials
ENCOMPASS_CLIENT_ID=...
ENCOMPASS_CLIENT_SECRET=...
# (password grant only)
ENCOMPASS_INSTANCE_ID=BE12345678
ENCOMPASS_API_USER=apiuser
ENCOMPASS_API_PASSWORD=...
```

If your ICE region uses a non-default base URL, override:

```
ENCOMPASS_API_BASE_URL=https://api.elliemae.com
ENCOMPASS_OAUTH_BASE_URL=https://api.elliemae.com
```

## 4. Test it from the dashboard

1. Run the portal: `npm run dev` (or open the deployed URL).
2. Go to **Connections**.
3. Click **Test connection** on the Encompass row.
4. The modal will show the env detected from your server-side variables.
   You can override any field for a one-off test (those values are used for
   that request only and are not stored in the browser).
5. Click **Run test**. The adapter will:
   - Exchange your credentials for an OAuth 2.0 token at
     `POST /oauth2/v1/token`.
   - Call `GET /encompass/v3/company/users/me` (falls back to a 1-row
     pipeline view).
   - Return token expiry, latency, and a sanity-check echo from EDC.

A green result means everything below is working end-to-end:

- OAuth client registration
- API user / persona scopes
- Network reachability to ICE
- Server-side token cache
- The no-deletion guardrail (blocks any `DELETE` at the HTTP layer before
  it leaves the process — see [`knowledge/policies/no-deletion.md`](../../../knowledge/policies/no-deletion.md))

## 5. Common errors

| Error code | What it means | Fix |
|---|---|---|
| `missing_credentials` | One or more required fields are blank | Re-check the env block or the modal form |
| `oauth_failed` HTTP 400 | Bad grant_type or malformed body | Verify grant matches what ICE provisioned |
| `oauth_failed` HTTP 401 | client_id / secret rejected | Re-issue the secret in EDC admin |
| `oauth_failed` HTTP 403 | API user lacks persona / scope | Attach the persona to the user, or add the scope to the app |
| `edc_error` HTTP 404 on `/users/me` | Tenant doesn't expose `/me`, falls back to pipeline | Usually self-resolves; if pipeline fails too, check scopes |
| `edc_error` HTTP 429 | Rate-limited | The adapter retries with Retry-After; persistent 429s mean your scope window is too tight |
| `ForbiddenOperationError` | A workflow tried to use a delete-style tool | This is the platform's **no-deletion guardrail** firing. Working as intended; remove the offending step |

## 6. Programmatic test (CI / shell)

The same flow can be exercised without the UI:

```bash
curl -sS -X POST http://localhost:3000/api/connections/encompass/test \
  -H 'content-type: application/json' \
  -d '{
    "env": "sandbox",
    "grantType": "client_credentials",
    "clientId": "...",
    "clientSecret": "..."
  }' | jq .
```

The response is the same shape the dashboard renders:

```json
{
  "ok": true,
  "result": {
    "env": "sandbox",
    "apiBaseUrl": "https://api.elliemae.com",
    "oauthBaseUrl": "https://api.elliemae.com",
    "tokenObtainedAt": 1762809600000,
    "tokenExpiresAt": 1762816800000,
    "latencyMs": 482,
    "sampleCount": 1,
    "echo": "apiuser@BE12345678"
  }
}
```
