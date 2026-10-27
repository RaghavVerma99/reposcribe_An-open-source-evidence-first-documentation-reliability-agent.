# Deploying RepoScribe

RepoScribe ships as **one FastAPI service that also serves the built Vite bundle**. That shape matters: audit
sessions and workspaces live in process memory, so the API must run as a single long-lived process, not as a
serverless function.

| Target | What runs there | Recommendation |
|---|---|---|
| **Render** | The whole app in one Docker web service | **Recommended.** One URL, same-origin cookies, uploads up to 20 MB |
| **Vercel** | The static UI, plus a small proxy to the Render API | Works, with limits: 4.5 MB request bodies and a serverless timeout |

You can deploy to both: Render for the API, Vercel for the UI. The proxy keeps the browser same-origin, so the
session cookie continues to work.

---

## 1. Before you deploy

```powershell
cd backend
.\.venv\Scripts\python.exe -m pytest -q      # 133 passed
cd ..\frontend
npm run typecheck                            # clean
npm run build                                # clean
npm run test:e2e                             # 11 passed, 42 checks
```

Then commit and push. A tag is optional; do not claim a release until CI is green on the pushed commit.

---

## 2. Render (recommended)

### Option A — Blueprint (fastest)

1. Push the repository to GitHub.
2. In Render, choose **New → Blueprint**.
3. Select the repository. Render reads `render.yaml` and shows one web service named `reposcribe`.
4. Click **Apply**. The first build installs Node, builds the UI, installs Python, and starts uvicorn.
5. Wait for the health check at `/api/v1/health` to pass, then open the service URL.

`render.yaml` sets `APP_ENV=production`, a generated `SESSION_SECRET`, `MODEL_PROVIDER=local_demo`, and
`WORKSPACE_ROOT=/tmp/reposcribe-workspaces`.

### Option B — Manual web service

1. **New → Web Service**, connect the repository.
2. Runtime: **Docker**. Dockerfile path: `./Dockerfile`.
3. Health check path: `/api/v1/health`.
4. Add the environment variables from the table below.
5. Create the service.

### Verify

- `https://<service>.onrender.com/api/v1/health` returns `{"status":"ok", ...}` with `provider.mode: "local_demo"`.
- The landing page loads, **Try sample repository** produces 10 findings, and a reload of
  `/r/<id>/findings` still works (single-service SPA fallback).
- The browser stores the `reposcribe_session` cookie and the session survives navigation.

### Free-plan caveats

- The instance sleeps after inactivity; the first request afterwards is slow.
- The free instance's filesystem is **ephemeral**. SQLite and workspaces are lost on sleep, restart, or deploy.
  See [Persistence](#persistence) below.
- One worker only. Do not raise `--workers`: the state cache and a per-process `SESSION_SECRET` assume one
  process.

### Persistence

RepoScribe stores durable state in SQLite at `REPOSCRIBE_DB_PATH` and repository files under
`WORKSPACE_ROOT`. Both must be on a filesystem that survives a restart. The signed session cookie also needs a
stable `SESSION_SECRET`, otherwise every restart issues new sessions.

On a paid Render instance, add a disk to the service:

```yaml
    disk:
      name: reposcribe-data
      mountPath: /var/data
      sizeGB: 1
    envVars:
      - key: REPOSCRIBE_DB_PATH
        value: /var/data/reposcribe.db
      - key: WORKSPACE_ROOT
        value: /var/data/workspaces
```

Then a sleep or deploy restores repositories, findings, audit history, and patches from the database. The
index is rebuilt from the workspace on first use. If the database survives but the workspace does not, history
stays readable and re-auditing returns `410 repository_expired` until the repository is uploaded again.

The free plan cannot attach a disk. For durable state there, use a paid instance, or replace the SQLite file
with an external database (not implemented).

---

## 3. Vercel (static UI + proxy)

Deploy Render first, then point Vercel at it.

1. In Vercel, **Add New → Project** and import the repository.
2. Framework preset: **Other**. Leave the root directory as the repository root; `vercel.json` already runs
   `cd frontend && npm ci && npm run build` and publishes `frontend/dist`.
3. Add an environment variable:
   - `BACKEND_ORIGIN` = `https://<your-service>.onrender.com` (no trailing slash)
4. Deploy.
5. Open the Vercel URL, run the sample audit, then reload a deep link such as `/r/<id>/findings`.

`vercel.json` rewrites `/api/v1/*` to `api/proxy.js`, which forwards method, body, headers, cookies, and the
response back to Render. `/` and client routes fall back to `index.html`.

### Vercel caveats

- **4.5 MB request limit** on serverless functions. The sample and typical ZIPs are fine; very large repository
  uploads should use the Render URL directly.
- **Function duration.** Audits are synchronous. The proxy asks for 60 seconds, but plan limits apply; a large
  repository can time out on Hobby.
- **Shared rate limit.** The backend limits 120 requests/minute per client address, and through the proxy every
  visitor shares Vercel's egress address. Fine for a demo; use the Render deployment for traffic.
- **Verify the proxy query string.** Open Findings, apply a status filter, and confirm the URL and results match.
  Filtering relies on query parameters surviving the rewrite.

If any of these limits matter, deploy the Render service only and skip Vercel.

---

## 4. Environment variables

| Variable | Required | Value |
|---|---|---|
| `APP_ENV` | Yes, production | `production` — also makes the session cookie `Secure` |
| `SESSION_SECRET` | Yes, production | A long random string, shared by every process |
| `MODEL_PROVIDER` | No | `local_demo` (default). Do not set `alan` until its contract is verified |
| `WORKSPACE_ROOT` | Yes on Render | `/tmp/reposcribe-workspaces` |
| `REPOSCRIBE_LOG_LEVEL` | No | `INFO` |
| `AUDIT_TIMEOUT_SECONDS` | No | `60` |
| `WORKSPACE_TTL_MINUTES` | No | `120` |
| `REPOSCRIBE_DB_PATH` | Yes for persistence | SQLite file on a restart-safe volume, e.g. `/var/data/reposcribe.db` |
| `MAX_UPLOAD_MB` | No | `20` |
| `MAX_CONCURRENT_WORKSPACES` | No | `32` on the public demo (the code default is 8) |
| `BACKEND_ORIGIN` | Vercel only | The Render service URL |

Never put a secret in a `VITE_` variable: Vite inlines those into the browser bundle.

---

## 5. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `backend_unreachable` from Vercel | `BACKEND_ORIGIN` missing or wrong | Set it to the Render URL, redeploy |
| Session resets on every request | Multiple workers or no shared `SESSION_SECRET` | Run one worker and set `SESSION_SECRET` |
| History is empty after a deploy or sleep | SQLite is on an ephemeral filesystem | Move `REPOSCRIBE_DB_PATH` to a mounted disk (paid Render) |
| `410 repository_expired` | The database survived but the workspace did not | Keep `WORKSPACE_ROOT` on the same persistent disk |
| Cookie missing in production | `APP_ENV` is not `production` | Set `APP_ENV=production` and use HTTPS |
| `413 payload_too_large` | Upload above `MAX_UPLOAD_MB`, or a JSON body above 1 MB | Raise the limit or use the ZIP upload path |
| `429 rate_limited` | More than 120 requests/minute from one address | Wait, or use the Render URL directly |
| Health check fails | The container cannot write `WORKSPACE_ROOT` | Point it at `/tmp/reposcribe-workspaces` |
| Deep link returns JSON 404 | Requested `/api/*`, or the SPA fallback is missing | Client routes should be non-API paths |

---

## 6. What is not production-grade yet

Be explicit about these in any public demo:

- Durable state requires a persistent disk. The free Render plan is ephemeral.
- Workspaces are disposable and expire after two hours of inactivity.
- The provider runs in `local_demo`; no live model is connected.
- No benchmark has measured precision or recall yet.
- SQLite is the only store; there are no accounts, and no multi-tenant isolation beyond the signed
  session cookie.

These are roadmap items, not defects to hide.
