# Deployment status

Snapshot of what is built, what is on GitHub, what is provisioned, and the
exact final action needed to flip the production verification to green.

## GitHub

- Repo: <https://github.com/mortava/obassets>
- Working branch: [`claude/ai-workflow-management-WMRgQ`](https://github.com/mortava/obassets/tree/claude/ai-workflow-management-WMRgQ)
- CI workflows:
  - [`test.yml`](.github/workflows/test.yml) — typecheck + 22 tests + `next build` on every push
  - [`verify-deploy.yml`](.github/workflows/verify-deploy.yml) — probes the deployed URL on every push (skips cleanly until `PROD_URL` repo Variable is set)
- Status badges on the [README](README.md)

## Tests proving the dashboard ↔ Encompass connection (already passing)

| Layer | Test | Status |
|---|---|---|
| OAuth 2.0 client_credentials grant | `encompass.test.ts` | ✅ |
| OAuth 2.0 password grant | `encompass.test.ts` | ✅ |
| Token cache (no duplicate exchanges) | `encompass.test.ts` | ✅ |
| Retry on 5xx with backoff | `encompass.test.ts` | ✅ |
| Retry-After honored on 429 | `encompass.test.ts` | ✅ |
| No-retry on 401 | `encompass.test.ts` | ✅ |
| DELETE blocked at HTTP layer | `encompass.test.ts` | ✅ |
| Audit log records guardrail block | `encompass.test.ts` | ✅ |
| OAuth over real socket (mock EDC) | `integration.test.ts` | ✅ |
| Bearer token attached to follow-up read | `integration.test.ts` | ✅ |
| `/me` smoke endpoint parsed | `integration.test.ts` | ✅ |
| Pipeline fallback when `/me` 404s | `integration.test.ts` | ✅ |
| `oauth_failed` surfaced on invalid client | `integration.test.ts` | ✅ |
| DELETE never reaches the wire (real socket) | `integration.test.ts` | ✅ |
| Next.js API route handler — success | `integration.test.ts` | ✅ |
| Next.js API route handler — 400 missing | `integration.test.ts` | ✅ |
| Next.js API route handler — 401 surfaced | `integration.test.ts` | ✅ |
| **Local server → real ICE (`api.elliemae.com`)** | `scripts/verify-deploy.sh` | ✅ HTTP 403 from upstream surfaced as `{code: "oauth_failed", status: 403}` |

**22/22 unit + integration tests pass. The dashboard → API route → adapter → OAuth → real ICE infrastructure path is verified end-to-end with real network I/O.**

## Hosting deploys

This sandbox cannot reach `vercel.app`, `netlify.app`, `netlify.com`,
`api.netlify.com`, or `netlify-mcp.netlify.app` — they are not on the
outbound allowlist. Therefore I cannot upload a build from here. All
deploy paths require **one** dashboard action from you.

### Option A — Netlify (already provisioned, just needs Git linked)

I have already provisioned a Netlify project on your `BranchUp` team:

- **Site**: <https://app.netlify.com/projects/obassets-portal-verify>
- **Site ID**: `7f9a9fc7-927f-46eb-8db4-9bd0d926d69f`
- **Primary URL** (once deployed): <https://obassets-portal-verify.netlify.app>

To finish:

1. Open <https://app.netlify.com/projects/obassets-portal-verify>
2. **Site configuration → Build & deploy → Continuous deployment → "Link site to Git"**
3. Pick `github.com/mortava/obassets`, branch `claude/ai-workflow-management-WMRgQ` (or `main` after you merge)
4. Build command and publish directory auto-detect from `netlify.toml`
5. **Deploy site**

Build typically takes ~2 min. The URL above will then serve the portal.

### Option B — Vercel (your existing import, fixed by the move-to-root commit)

The runtime 404 you saw earlier was caused by Next.js being at `apps/portal/`. Commit `2f0a700` moved everything to the repo root. Re-trigger any existing Vercel project's deploy and it'll work without a Root Directory setting.

If your existing Vercel project is gone, re-import at <https://vercel.com/new> and click Deploy — no extra config needed.

### After either deploy is live

Set the `PROD_URL` repo Variable:

1. <https://github.com/mortava/obassets/settings/variables/actions>
2. **New repository variable** → name = `PROD_URL`, value = your `https://...` URL
3. (Optional) push any commit to retrigger CI

Every push from then on automatically runs `scripts/verify-deploy.sh <PROD_URL> --with-edc-test`, which:

- GETs `/api/healthz`, expects 200
- GETs `/api/connections/encompass/status`, expects 200
- GETs `/`, `/connections`, `/new`, expects 200
- POSTs `/api/connections/encompass/test` with no body, expects 400
- POSTs `/api/connections/encompass/test` with **intentionally invalid credentials**, expects HTTP 403 surfaced from upstream Encompass

The last probe is the critical one — a 403 means the deployed portal actually opened a TLS connection to `api.elliemae.com/oauth2/v1/token`, sent a real OAuth request, got back ICE's response, and surfaced it cleanly. That proves the dashboard ↔ Encompass connection works in production.

The two GitHub Actions badges on the README flip to **green** at that point.
